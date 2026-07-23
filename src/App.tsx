import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, arrayUnion, deleteDoc } from 'firebase/firestore';
import { 
  Trash2, Undo2, Check, PlusCircle, Settings, LogOut, Train, Bus, Navigation,
  Clock, RefreshCw, EyeOff, History, X, Pencil, Pause, Play, StopCircle, Wifi, WifiOff, HelpCircle
} from 'lucide-react';

// --- Firebase Configuration ---
// Import the functions you need from the SDKs you need
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCdnUmQvuzURBA1bZAkhyFh2MvuHKgx32M",
  authDomain: "stadtbezirk-scramble-32d93.firebaseapp.com",
  projectId: "stadtbezirk-scramble-32d93",
  storageBucket: "stadtbezirk-scramble-32d93.firebasestorage.app",
  messagingSenderId: "359696096464",
  appId: "1:359696096464:web:9e14dea7f0ce887a0052d5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'bezirk-scramble';

// --- Game Constants ---
const INITIAL_PASSWORDS = {
  admin: "Hello World",
  orange: "Cat behaviour",
  blue: "Schlumpf123"
};

const TRANSPORT_COSTS = {
  sbahn: 200,
  ubahn: 150,
  bus: 50,
  tram: 50
};

// Default Deck
const DEFAULT_DECK = [
  "Altstadt-Lehel", "Ludwigsvorstadt-Isarvorstadt", "Maxvorstadt", "Schwabing-West", 
  "Au-Haidhausen", "Sendling", "Sendling-Westpark", "Schwanthalerhöhe", 
  "Neuhausen-Nymphenburg", "Moosach", "Milbertshofen-Am Hart", "Schwabing-Freimann", 
  "Bogenhausen", "Berg am Laim", "Trudering-Riem", "Ramersdorf-Perlach", 
  "Obergiesing-Fasangarten", "Untergiesing-Harlaching", "Thalkirchen-Obersendling", 
  "Hadern", "Pasing-Obermenzing", "Aubing-Lochhausen-Langwied", "Allach-Untermenzing", 
  "Feldmoching-Hasenbergl", "Laim"
];

const shuffleArray = (array) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [lobbyState, setLobbyState] = useState({ readyOrange: false, readyBlue: false });
  const [role, setRole] = useState(null);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Tutorial State
  const [showTutorial, setShowTutorial] = useState(false);
  const [blindAdmin, setBlindAdmin] = useState(true);

  // Admin states
  const [newCardName, setNewCardName] = useState("");
  const [newCardTarget, setNewCardTarget] = useState("deck");
  const [passAdmin, setPassAdmin] = useState("");
  const [passOrange, setPassOrange] = useState("");
  const [passBlue, setPassBlue] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [pointEditTeam, setPointEditTeam] = useState(null);
  const [pointEditValue, setPointEditValue] = useState("");
  const [editHours, setEditHours] = useState("");
  const [editMinutes, setEditMinutes] = useState("");

  const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'main');
  const lobbyRef = doc(db, 'artifacts', appId, 'public', 'data', 'gameState', 'lobby');

  // 1. Auth & Firebase Init
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
      }
    };
    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  // 1.5 Online Status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Fetch Data
  useEffect(() => {
    if (!user) return;

    const unsubscribeDB = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setGameState(snap.data());
      } else {
        setGameState(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore Listen Error:", err);
      setLoading(false);
    });

    const unsubscribeLobby = onSnapshot(lobbyRef, (snap) => {
      if (snap.exists()) {
        setLobbyState(snap.data());
      } else {
        setLobbyState({ readyOrange: false, readyBlue: false });
      }
    });

    return () => {
      unsubscribeDB();
      unsubscribeLobby();
    };
  }, [user]);

  // 3. Auto-Start Listener
  useEffect(() => {
    if (!gameState && lobbyState?.readyOrange && lobbyState?.readyBlue) {
      initializeGame();
    }
  }, [lobbyState, gameState]);

  // 4. Timer for Unlocking Cards
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // --- TIME & AUTOMATED POINTS LOGIC ---
  const getActiveElapsedMs = () => {
    if (!gameState) return 0;
    if (gameState.status === 'paused' && gameState.pausedAt) {
      return Math.max(0, gameState.pausedAt - gameState.startTime);
    }
    if (gameState.status === 'ended' && gameState.endedAt) {
      return Math.max(0, gameState.endedAt - gameState.startTime);
    }
    return Math.max(0, now - gameState.startTime);
  };

  const getCurrentBonus = () => {
    if (!gameState) return 0;
    const elapsedMs = getActiveElapsedMs();
    return Math.floor(elapsedMs / (2 * 60 * 60 * 1000)) * 1000;
  };

  const getCalculatedPoints = (team) => {
    if (!gameState) return 0;
    return gameState.points[team] + getCurrentBonus();
  };

  // --- ACTIONS ---
  const logAction = (msg) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return { time: timeStr, msg };
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError("");

    const pwLower = loginPassword.toLowerCase().trim();
    
    const easterEggs = {
      "42": "42 ist wohl doch nicht die Lösung für das Leben, das Universum und den ganzen Rest...",
      "passwort": "Wirklich? \"passwort\"?",
      "max": "Wer das ließt ist dumm!",
      "rick astley": "Never gonna give you up, never gonna let you down!",
      "404": "Not found",
      "123456": "Das ist die Kombination für den Koffer eines Idioten! Versuch’s nochmal.",
      "qwertz": "Einfach einmal quer über die Tastatur gewischt, was? Sei kreativ!",
      "qwerty": "Einfach einmal quer über die Tastatur gewischt, was? Sei kreativ!",
      "admin": "Netter Versuch, Chef. Aber nein.",
      "hallo": "Tschüss. (Falsches Passwort)",
      "geheim": "Wenn das wirklich geheim wäre, hättest du dir was Besseres ausgedacht.",
      "passwort123": "Wow, die Kombination aus den beiden schlechtesten Ideen überhaupt. Respekt. Aber nein.",
      "hallo123": "Ah, das '123' am Ende macht es natürlich absolut unknackbar. Spaß, du kommst hier nicht rein.",
      "0000": "Ist dein Handy-PIN zufällig der gleiche? Ändere beides. Jetzt.",
      "1111": "Ist dein Handy-PIN zufällig der gleiche? Ändere beides. Jetzt.",
      "123456789": "Oh, du kennst alle Zahlen auf der Tastatur! Schön für dich. Trotzdem falsch.",
      "1234567890": "Oh, du kennst alle Zahlen auf der Tastatur! Schön für dich. Trotzdem falsch.",
      "hilfe": "Mein einziger Tipp: Es war nicht „hilfe“",
      "bitte": "Höflichkeit bringt dich im echten Leben weiter, aber nicht an meiner Firewall vorbei.",
      "rote pille": "Du bist nicht der Auserwählte. Zumindest nicht mit diesem Passwort. Willkommen in der Realität.",
      "blaue pille": "Du bist nicht der Auserwählte. Zumindest nicht mit diesem Passwort. Willkommen in der Realität.",
      "fight club": "Regel Nummer 1: Wir sprechen nicht über dein Passwort. Regel Nummer 2: Du hast es gerade falsch eingegeben.",
      "zelda": "It's dangerous to go alone! Nimm lieber einen Passwort-Manager mit.",
      "cake": "The cake is a lie. Dein Passwort übrigens auch.",
      "kuchen": "The cake is a lie. Dein Passwort übrigens auch."
    };

    if (easterEggs[pwLower]) {
      setLoginError(easterEggs[pwLower]);
      return;
    }

    const checkPass = (gameP, initialP) => loginPassword === (gameP || initialP);

    if (gameState) {
      if (checkPass(gameState.passwords?.admin, INITIAL_PASSWORDS.admin)) setRole('admin');
      else if (checkPass(gameState.passwords?.orange, INITIAL_PASSWORDS.orange)) setRole('orange');
      else if (checkPass(gameState.passwords?.blue, INITIAL_PASSWORDS.blue)) setRole('blue');
      else setLoginError("Falsches Passwort!");
    } else {
      if (loginPassword === INITIAL_PASSWORDS.admin) setRole('admin');
      else if (loginPassword === INITIAL_PASSWORDS.orange) setRole('orange');
      else if (loginPassword === INITIAL_PASSWORDS.blue) setRole('blue');
      else setLoginError("Falsches Passwort!");
    }
  };

  const initializeGame = async () => {
    const snap = await getDoc(docRef);
    if (snap.exists()) return; 

    const shuffledDeck = shuffleArray(DEFAULT_DECK);
    const privateOrange = shuffledDeck.splice(0, 3);
    const privateBlue = shuffledDeck.splice(0, 3);
    const open = shuffledDeck.splice(0, 4);

    const initialState = {
      startTime: Date.now(),
      status: 'active',
      pausedAt: null,
      endedAt: null,
      passwords: INITIAL_PASSWORDS,
      points: { orange: 3000, blue: 3000 },
      deck: shuffledDeck,
      openCards: open,
      privateOrange: privateOrange,
      privateBlue: privateBlue,
      claimedOrange: [],
      claimedBlue: [],
      deletedCards: [],
      logs: [logAction("Spiel wurde gestartet.")]
    };

    await setDoc(docRef, initialState);
    await setDoc(lobbyRef, { readyOrange: false, readyBlue: false });
  };

  const updateGame = async (updates, logMsg) => {
    if (!gameState) return;
    try {
      const payload = { ...updates };
      if (logMsg) {
        payload.logs = arrayUnion(logAction(logMsg));
      }
      await updateDoc(docRef, payload);
    } catch (err) {
      console.error("Error updating game state:", err);
    }
  };

  // --- Game Mechanics ---
  const handleUnclaimCard = (card, team) => {
    const teamClaimedField = team === 'orange' ? 'claimedOrange' : 'claimedBlue';
    const newClaimed = gameState[teamClaimedField].filter(c => c !== card);
    updateGame({
      [teamClaimedField]: newClaimed,
      deck: [...gameState.deck, card]
    }, `Admin hat den Claim von "${card}" (${team === 'orange' ? 'Orange' : 'Blau'}) rückgängig gemacht.`);
  };

  const handleClaimCard = (card, team, listKey) => {
    if (gameState.status !== 'active' && role !== 'admin') return;
    const newList = gameState[listKey].filter(c => c !== card);
    const teamClaimedField = team === 'orange' ? 'claimedOrange' : 'claimedBlue';
    const newClaimed = [...(gameState[teamClaimedField] || []), card];
    
    let newDeck = [...gameState.deck];
    let updates = {
      [listKey]: newList,
      [teamClaimedField]: newClaimed
    };

    if (listKey === 'openCards' && newDeck.length > 0 && newList.length < 4) {
      newList.push(newDeck.shift());
      updates.deck = newDeck;
    }

    const teamName = team === 'orange' ? 'Orange' : 'Blau';
    const sourceName = listKey === 'openCards' ? 'offenen Bezirken' : 'privaten Karten';
    updateGame(updates, `Team ${teamName} claimt Bezirk ${card} (aus ${sourceName}).`);
  };

  // Ersetzt eine Karte (privat oder offen): Löscht die alte und zieht eine neue
  const handleReplaceCard = (card, listKey) => {
    if (gameState.status !== 'active' && role !== 'admin') return;
    if (gameState.deck.length === 0) return alert("Der Stapel ist leer!");
    
    const newDeck = [...gameState.deck];
    const newCard = newDeck.shift(); 
    
    const teamCards = [...gameState[listKey]];
    const cardIndex = teamCards.indexOf(card);
    if (cardIndex > -1) {
      teamCards[cardIndex] = newCard; 
    }

    let logMsg = "";
    if (listKey === 'openCards') {
      const actor = role === 'admin' ? 'Admin' : (role === 'orange' ? 'Team Orange' : 'Team Blau');
      logMsg = `${actor} hat den offenen Bezirk "${card}" ersetzt (gelöscht).`;
    } else {
      const teamDisplay = listKey === 'privateOrange' ? 'Orange' : 'Blau';
      logMsg = `Team ${teamDisplay} hat die private Karte "${card}" endgültig ersetzt (gelöscht).`;
    }
    
    updateGame({
      deck: newDeck,
      [listKey]: teamCards,
      deletedCards: [...(gameState.deletedCards || []), card]
    }, logMsg);
  };

  // Legt eine offene Karte an einer zufälligen Position zurück in den Stapel und zieht eine neue
  const handleReturnRandomToDeck = (card, listKey) => {
    if (gameState.status !== 'active' && role !== 'admin') return;
    if (gameState.deck.length === 0) return alert("Der Stapel ist leer!");
    
    const newDeck = [...gameState.deck];
    const newCard = newDeck.shift();
    
    const randomIndex = Math.floor(Math.random() * (newDeck.length + 1));
    newDeck.splice(randomIndex, 0, card);
    
    const newList = [...gameState[listKey]];
    const cardIndex = newList.indexOf(card);
    if (cardIndex > -1) {
      newList[cardIndex] = newCard; 
    }

    const actor = role === 'admin' ? 'Admin' : (role === 'orange' ? 'Team Orange' : 'Team Blau');
    updateGame({
      deck: newDeck,
      [listKey]: newList
    }, `${actor} hat den offenen Bezirk "${card}" zufällig in den Stapel zurückgemischt und ersetzt.`);
  };

  const handleDrawCard = (targetList, logName) => {
    if (gameState.status !== 'active' && role !== 'admin') return;
    if (gameState.deck.length === 0) return alert("Der Stapel ist leer!");
    const newDeck = [...gameState.deck];
    const card = newDeck.shift();
    updateGame({
      deck: newDeck,
      [targetList]: [...gameState[targetList], card]
    }, `Eine neue Karte wurde gezogen für: ${logName}`);
  };

  const handleTransportDeduction = (team, type, cost) => {
    if (gameState.status !== 'active' && role !== 'admin') return;
    const newPoints = { ...gameState.points };
    newPoints[team] -= cost;
    const teamName = team === 'orange' ? 'Orange' : 'Blau';
    updateGame({ points: newPoints }, `Team ${teamName} nutzt ${type} (-${cost} Punkte).`);
  };

  // --- Admin Methods ---
  const handleAdminAddCard = (e) => {
    e.preventDefault();
    if (!newCardName.trim()) return;
    updateGame({
      [newCardTarget]: [...gameState[newCardTarget], newCardName.trim()]
    }, `Admin hat die Karte "${newCardName}" zu [${newCardTarget}] hinzugefügt.`);
    setNewCardName("");
  };

  const handleDeleteFromDeck = (card) => {
    const newDeck = gameState.deck.filter(c => c !== card);
    updateGame({
      deck: newDeck,
      deletedCards: [...(gameState.deletedCards || []), card]
    }, `Admin hat "${card}" direkt aus dem Stapel gelöscht.`);
  };

  const handleChangePasswords = (e) => {
    e.preventDefault();
    const newPass = {
      admin: passAdmin || gameState.passwords.admin,
      orange: passOrange || gameState.passwords.orange,
      blue: passBlue || gameState.passwords.blue,
    };
    updateGame({ passwords: newPass }, "Admin hat die Passwörter aktualisiert.");
    setPassAdmin(""); setPassOrange(""); setPassBlue("");
  };

  const handleSavePoints = () => {
    if (pointEditTeam && pointEditValue !== "") {
      const targetValue = parseInt(pointEditValue, 10);
      if (!isNaN(targetValue)) {
        const newBase = targetValue - getCurrentBonus();
        const newPoints = { ...gameState.points, [pointEditTeam]: newBase };
        updateGame(
          { points: newPoints }, 
          `Admin hat die Punkte von Team ${pointEditTeam === 'orange' ? 'Orange' : 'Blau'} auf ${targetValue} gesetzt.`
        );
      }
    }
    setPointEditTeam(null);
    setPointEditValue("");
  };

  const timeTravel = (hours) => {
    const newStartTime = gameState.startTime - (hours * 60 * 60 * 1000);
    updateGame({ startTime: newStartTime }, `Admin hat die Spielzeit um ${hours}h vorgestellt (Testfunktion).`);
  };

  const handleSetTime = (e) => {
    e.preventDefault();
    const h = parseInt(editHours || "0", 10);
    const m = parseInt(editMinutes || "0", 10);
    if (!isNaN(h) && !isNaN(m)) {
      const targetElapsedMs = (h * 60 * 60 * 1000) + (m * 60 * 1000);
      let newStartTime;
      if (gameState.status === 'paused' && gameState.pausedAt) {
        newStartTime = gameState.pausedAt - targetElapsedMs;
      } else if (gameState.status === 'ended' && gameState.endedAt) {
        newStartTime = gameState.endedAt - targetElapsedMs;
      } else {
        newStartTime = Date.now() - targetElapsedMs;
      }
      updateGame({ startTime: newStartTime }, `Admin hat die Spielzeit auf ${h}h ${m}m gesetzt.`);
      setEditHours("");
      setEditMinutes("");
    }
  };

  const togglePause = () => {
    if (gameState.status === 'paused') {
      const pauseDuration = Date.now() - gameState.pausedAt;
      updateGame({ 
        status: 'active', 
        pausedAt: null, 
        startTime: gameState.startTime + pauseDuration 
      }, "Admin hat das Spiel fortgesetzt.");
    } else {
      updateGame({ status: 'paused', pausedAt: Date.now() }, "Admin hat das Spiel pausiert.");
    }
  };

  const toggleEnd = () => {
    if (gameState.status === 'ended') {
      const endDuration = Date.now() - gameState.endedAt;
      updateGame({ 
        status: 'active', 
        endedAt: null, 
        startTime: gameState.startTime + endDuration 
      }, "Admin hat das Spiel wieder aufgenommen (aus Beendet).");
    } else {
      updateGame({ status: 'ended', endedAt: Date.now() }, "Admin hat das Spiel beendet.");
    }
  };

  const handleEndGame = async () => {
    try {
      await deleteDoc(docRef);
      await setDoc(lobbyRef, { readyOrange: false, readyBlue: false });
      setConfirmEnd(false);
    } catch (err) {
      console.error("Fehler beim Beenden des Spiels:", err);
    }
  };

  // --- Rendering Helpers ---
  const isCardVisible = (index) => {
    if (!gameState) return false;
    const elapsedMs = getActiveElapsedMs();
    if (index === 0) return true; 
    if (index === 1) return elapsedMs >= 2 * 60 * 60 * 1000; 
    if (index >= 2) return elapsedMs >= 4 * 60 * 60 * 1000; 
    return false;
  };

  const renderCard = (card, sourceName, listKey, bgColor = "bg-white", textColor = "text-gray-800") => {
    const isPrivate = listKey === 'privateOrange' || listKey === 'privateBlue';
    const isMyPrivateCard = (role === 'orange' && listKey === 'privateOrange') || (role === 'blue' && listKey === 'privateBlue');
    const canClaim = listKey === 'openCards' || isMyPrivateCard;
    
    return (
      <div key={card} className={`p-4 rounded-xl shadow-md border-2 border-gray-100 flex flex-col justify-between space-y-3 relative ${bgColor} ${textColor}`}>
        <div className="font-bold text-lg text-center leading-tight">{card}</div>
        
        <div className="flex flex-col space-y-2">
          {role === 'admin' && listKey === 'openCards' && (
            <div className="flex space-x-1">
              <button onClick={() => handleClaimCard(card, 'orange', listKey)} className="flex-1 py-1 bg-orange-500 text-white font-bold rounded hover:bg-orange-600 text-sm">
                Orange
              </button>
              <button onClick={() => handleClaimCard(card, 'blue', listKey)} className="flex-1 py-1 bg-blue-500 text-white font-bold rounded hover:bg-blue-600 text-sm">
                Blau
              </button>
            </div>
          )}

          {(role === 'orange' || role === 'blue') && canClaim && (
            <button 
              disabled={gameState.status !== 'active'}
              onClick={() => handleClaimCard(card, role, listKey)}
              className="w-full flex justify-center items-center space-x-1 py-1.5 bg-indigo-600 text-white font-bold rounded shadow-sm hover:bg-indigo-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={16} /> <span>Claimen</span>
            </button>
          )}

          <div className="flex justify-between items-center space-x-2">
            {!isPrivate && role === 'admin' && (
              <button 
                onClick={() => handleDeleteCard(card, sourceName, listKey)}
                className="p-2 bg-red-100 text-red-700 rounded-full hover:bg-red-200" title="Ersatzlos löschen (Nur Admin)">
                <Trash2 size={18} />
              </button>
            )}
            
            {!isPrivate && (
              <button 
                disabled={gameState.status !== 'active' && role !== 'admin'}
                onClick={() => handleReturnRandomToDeck(card, listKey)}
                className="p-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed" title="Zufällig in Stapel mischen & Neu ziehen">
                <Undo2 size={18} />
              </button>
            )}

            {!isPrivate && (
              <button 
                disabled={gameState.status !== 'active' && role !== 'admin'}
                onClick={() => handleReplaceCard(card, listKey)}
                className="p-2 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed" title="Ersetzen (Löschen & Neu ziehen)">
                <RefreshCw size={18} />
              </button>
            )}
            
            {isPrivate && (
              <button 
                disabled={gameState.status !== 'active' && role !== 'admin'}
                onClick={() => handleReplaceCard(card, listKey)}
                className="flex-1 flex justify-center items-center space-x-2 py-1.5 bg-white text-gray-800 rounded border border-gray-200 hover:bg-gray-100 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Ersetzen (Karte wird gelöscht)">
                <RefreshCw size={16} /> <span className="text-sm">Ersetzen</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const getElapsedTime = () => {
    if (!gameState) return "";
    const elapsedMs = getActiveElapsedMs();
    if (elapsedMs < 0) return "0h 0m";
    const h = Math.floor(elapsedMs / (1000 * 60 * 60));
    const m = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m`;
  };

  // --- VIEWS ---
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><RefreshCw className="animate-spin text-gray-400" size={32} /></div>;
  }

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full">
          <h1 className="text-2xl font-black mb-6 text-center text-gray-800">Stadtbezirk Scramble</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Passwort</label>
              <input 
                type="password" 
                value={loginPassword} 
                onChange={e => setLoginPassword(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg p-3 outline-none focus:border-blue-500"
                placeholder="Team oder Admin Passwort..."
              />
            </div>
            {loginError && <p className="text-red-500 text-sm font-bold">{loginError}</p>}
            <button type="submit" className="w-full bg-gray-800 text-white font-bold py-3 rounded-lg hover:bg-gray-900 transition">
              Einloggen
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!gameState && role === 'admin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
        <h1 className="text-3xl font-black mb-4">Willkommen, Admin</h1>
        <p className="mb-2 text-gray-600">Das Spiel wurde noch nicht gestartet oder wurde beendet.</p>
        <div className="flex space-x-4 mb-8 mt-4">
          <div className={`px-4 py-2 rounded-lg font-bold flex items-center space-x-2 border-2 ${lobbyState?.readyOrange ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-400'}`}>
            <Check size={18} className={lobbyState?.readyOrange ? 'opacity-100' : 'opacity-30'} /> <span>Orange</span>
          </div>
          <div className={`px-4 py-2 rounded-lg font-bold flex items-center space-x-2 border-2 ${lobbyState?.readyBlue ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-400'}`}>
            <Check size={18} className={lobbyState?.readyBlue ? 'opacity-100' : 'opacity-30'} /> <span>Blau</span>
          </div>
        </div>
        <button onClick={initializeGame} className="bg-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-green-700 flex items-center space-x-2">
          <Play size={24} /> <span>Spiel sofort erzwingen</span>
        </button>
      </div>
    );
  }

  if (!gameState && role !== 'admin') {
    const isReady = role === 'orange' ? lobbyState?.readyOrange : lobbyState?.readyBlue;
    const otherReady = role === 'orange' ? lobbyState?.readyBlue : lobbyState?.readyOrange;

    const setReadyState = async (state) => {
      const roleKey = role === 'orange' ? 'readyOrange' : 'readyBlue';
      await setDoc(lobbyRef, { [roleKey]: state }, { merge: true });
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 select-none">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center flex flex-col items-center">
          <RefreshCw size={48} className={`mx-auto mb-6 ${isReady && otherReady ? 'text-green-500 animate-spin' : 'text-blue-500 animate-spin'}`} />
          <h2 className="text-xl font-bold mb-2 text-gray-800">Warteraum</h2>
          <p className="text-gray-600 mb-6">
            Du bist als <strong>Team {role === 'orange' ? 'Orange' : 'Blau'}</strong> eingeloggt.<br/><br/>
            <strong>Halte den Knopf unten gedrückt!</strong> Sobald beide Teams gleichzeitig gedrückt halten, startet das Spiel automatisch.
          </p>

          <div className="w-full space-y-3 mb-6">
            <button 
              onPointerDown={() => setReadyState(true)}
              onPointerUp={() => setReadyState(false)}
              onPointerLeave={() => setReadyState(false)}
              onContextMenu={(e) => e.preventDefault()}
              className={`w-full font-bold py-6 rounded-lg transition-all touch-none select-none text-white ${isReady ? 'bg-green-500 shadow-inner scale-95' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md'}`}
            >
              {isReady ? (
                <span className="flex justify-center items-center space-x-2">
                  <Check size={24}/>
                  <span className="text-lg">HALTEN...</span>
                </span>
              ) : (
                <span className="text-lg">Gedrückt halten!</span>
              )}
            </button>
            <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between items-center">
              <span>Team {role === 'orange' ? 'Blau' : 'Orange'}:</span>
              <span className={`font-bold px-2 py-1 rounded text-xs ${otherReady ? 'bg-green-100 text-green-700 animate-pulse' : 'bg-yellow-100 text-yellow-700'}`}>
                {otherReady ? 'HÄLT GEDRÜCKT!' : 'WARTET...'}
              </span>
            </div>
          </div>
          <button onClick={() => setRole(null)} className="w-full border-2 border-gray-200 text-gray-600 font-bold py-2 rounded-lg hover:bg-gray-50 transition">
            Abmelden
          </button>
        </div>
      </div>
    );
  }

  const myTeam = role === 'admin' ? null : role;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      
      {/* Tutorial Modal */}
      {showTutorial && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col text-gray-800">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <h2 className="text-xl font-bold flex items-center space-x-2 text-indigo-600">
                <HelpCircle size={24}/> <span>App & Spiel Tutorial</span>
              </h2>
              <button onClick={() => setShowTutorial(false)} className="p-2 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors">
                <X size={20}/>
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-5 text-sm leading-relaxed">
               
               <div>
                 <h3 className="font-bold text-lg text-gray-900 border-b pb-1 mb-2">Ziel des Spiels</h3>
                 <p>Sammle die meisten an sich aneinander angrenzenden Bezirke!</p>
               </div>
               
               <div>
                 <h3 className="font-bold text-lg text-gray-900 border-b pb-1 mb-2">Die Benutzeroberfläche (UI)</h3>
                 <ul className="space-y-3">
                    <li className="flex gap-2">
                      <Train className="text-blue-500 shrink-0 mt-0.5" size={18}/>
                      <span><strong>Transport:</strong> Klickt auf die Buttons (S-Bahn, U-Bahn, Bus, Tram), um die jeweiligen Fahrtkosten sofort von euren Punkten abzuziehen. Denkt daran: Jede Haltestelle kostet!</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="text-green-500 shrink-0 mt-0.5" size={18}/>
                      <span><strong>Claimen:</strong> 4 Bezirke liegen für beide Teams offen aus. Klickt auf "Claimen", wenn ihr die Challenge für den Bezirk erfüllt habt. Wenn ihr erfolgreich seid, wird eine neue Karte nachgezogen.</span>
                    </li>
                    <li className="flex gap-2">
                      <EyeOff className="text-gray-500 shrink-0 mt-0.5" size={18}/>
                      <span><strong>Private Karten:</strong> Ihr habt 3 eigene Bezirke. Karte 1 ist sofort sichtbar, Karte 2 wird nach 2 Stunden freigeschaltet, Karte 3 nach 4 Stunden.</span>
                    </li>
                    <li className="flex gap-2">
                      <RefreshCw className="text-blue-500 shrink-0 mt-0.5" size={18}/>
                      <span><strong>Ersetzen:</strong> Wenn eine Challenge nicht absolvierbar ist, könnt ihr sie ersetzen. Die Karte wird dabei komplett gelöscht und ihr erhaltet sofort eine neue Karte an derselben Stelle.</span>
                    </li>
                    <li className="flex gap-2">
                      <Undo2 className="text-gray-600 shrink-0 mt-0.5" size={18}/>
                      <span><strong>Zurück zum Deck:</strong> Offene Karten können zufällig in den Ziehstapel zurückgemischt werden. Ihr erhaltet stattdessen sofort eine neue offene Karte.</span>
                    </li>
                 </ul>
               </div>

               <div>
                 <h3 className="font-bold text-lg text-gray-900 border-b pb-1 mb-2">Punkte & Zeit</h3>
                 <p>
                   Ihr startet mit <strong>3000 Punkten</strong>. <br/>
                   Alle 2 Stunden erhaltet ihr automatisch einen Bonus von <strong>+1000 Punkten</strong>. Der Timer läuft live oben rechts in der Leiste.
                 </p>
               </div>

            </div>
            <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowTutorial(false)} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                Alles klar, let's go!
              </button>
            </div>
          </div>
        </div>
      )}

      <header className={`p-4 text-white shadow-md flex justify-between items-center ${role === 'admin' ? 'bg-gray-800' : role === 'orange' ? 'bg-orange-500' : 'bg-blue-600'}`}>
        <div className="flex items-center space-x-2">
          <Navigation className="text-white opacity-80" />
          <h1 className="text-xl font-black tracking-tight">Stadtbezirk Scramble</h1>
        </div>
        
        <div className="flex space-x-3 sm:space-x-6 items-center text-sm font-medium">
          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-bold ${isOnline ? 'bg-green-500/20 text-green-100' : 'bg-red-500 text-white animate-pulse'}`}>
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          <button onClick={() => setShowTutorial(true)} className="flex items-center space-x-1 bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full transition-colors">
            <HelpCircle size={16} /> <span className="hidden sm:inline">Tutorial</span>
          </button>

          <div className="flex items-center space-x-1 opacity-90 bg-white/20 px-3 py-1 rounded-full">
            <Clock size={16} />
            <span>Spielzeit: {getElapsedTime()}</span>
          </div>
          
          <button onClick={() => setRole(null)} className="flex items-center space-x-1 hover:text-gray-200">
            <LogOut size={16} /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {gameState.status === 'paused' && (
        <div className="bg-yellow-500 text-white font-bold text-center py-2 animate-pulse flex items-center justify-center space-x-2">
          <Pause size={20} /> <span>SPIEL PAUSIERT</span>
        </div>
      )}
      {gameState.status === 'ended' && (
        <div className="bg-red-600 text-white font-bold text-center py-2 flex items-center justify-center space-x-2">
          <StopCircle size={20} /> <span>SPIEL BEENDET</span>
        </div>
      )}

      <main className="flex-1 p-4 max-w-7xl w-full mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN */}
        <div className="md:col-span-4 space-y-6">
          
          {role === 'admin' && !blindAdmin && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-xl font-bold mb-4">Punkte Übersicht</h2>
              <div className="space-y-3">
                {['orange', 'blue'].map((t) => (
                  <div key={t} className={`flex justify-between items-center p-3 rounded-lg ${t === 'orange' ? 'bg-orange-50' : 'bg-blue-50'}`}>
                    <span className={`font-bold ${t === 'orange' ? 'text-orange-700' : 'text-blue-700'}`}>
                      Team {t === 'orange' ? 'Orange' : 'Blau'}
                    </span>
                    {pointEditTeam === t ? (
                      <div className="flex items-center space-x-1">
                        <input 
                          type="number" 
                          className="w-20 p-1 text-sm border border-gray-300 rounded text-right"
                          value={pointEditValue}
                          onChange={(e) => setPointEditValue(e.target.value)}
                          autoFocus
                        />
                        <button onClick={handleSavePoints} className="bg-green-500 text-white p-1 rounded hover:bg-green-600">
                          <Check size={16}/>
                        </button>
                        <button onClick={() => setPointEditTeam(null)} className="bg-gray-400 text-white p-1 rounded hover:bg-gray-500">
                          <X size={16}/>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span className={`font-bold text-lg ${t === 'orange' ? 'text-orange-900' : 'text-blue-900'}`}>
                          ⭐ {getCalculatedPoints(t)}
                        </span>
                        <button 
                          onClick={() => { setPointEditTeam(t); setPointEditValue(getCalculatedPoints(t)); }} 
                          className="text-gray-400 hover:text-gray-700 p-1" title="Punkte bearbeiten">
                          <Pencil size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <div className="text-xs text-gray-500 text-center mt-2">
                  (Inklusive automatischer +{getCurrentBonus()} Bonuspunkte durch Zeit)
                </div>
              </div>
            </div>
          )}

          {myTeam && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-xl font-bold mb-4 flex justify-between items-center">
                Team {myTeam === 'orange' ? 'Orange' : 'Blau'}
                <div className="flex flex-col items-end">
                  <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-lg">
                    ⭐ {getCalculatedPoints(myTeam)}
                  </span>
                  {getCurrentBonus() > 0 && (
                     <span className="text-xs text-gray-400 mt-1">inkl. +{getCurrentBonus()} Zeit-Bonus</span>
                  )}
                </div>
              </h2>
              <div className="space-y-3 mb-2">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Transport Nutzen (Punkte abziehen)</p>
                <div className="grid grid-cols-2 gap-2">
                  <button disabled={gameState.status !== 'active'} onClick={() => handleTransportDeduction(myTeam, 'S-Bahn', TRANSPORT_COSTS.sbahn)} className="disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 p-2 rounded-lg text-sm font-bold">
                    <Train size={16} className="text-green-600"/> <span>-{TRANSPORT_COSTS.sbahn}</span>
                  </button>
                  <button disabled={gameState.status !== 'active'} onClick={() => handleTransportDeduction(myTeam, 'U-Bahn', TRANSPORT_COSTS.ubahn)} className="disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 p-2 rounded-lg text-sm font-bold">
                    <Train size={16} className="text-blue-600"/> <span>-{TRANSPORT_COSTS.ubahn}</span>
                  </button>
                  <button disabled={gameState.status !== 'active'} onClick={() => handleTransportDeduction(myTeam, 'Bus', TRANSPORT_COSTS.bus)} className="disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 p-2 rounded-lg text-sm font-bold">
                    <Bus size={16} className="text-gray-600"/> <span>-{TRANSPORT_COSTS.bus}</span>
                  </button>
                  <button disabled={gameState.status !== 'active'} onClick={() => handleTransportDeduction(myTeam, 'Tram', TRANSPORT_COSTS.tram)} className="disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 p-2 rounded-lg text-sm font-bold">
                    <Train size={16} className="text-red-500"/> <span>-{TRANSPORT_COSTS.tram}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {(myTeam || (role === 'admin' && !blindAdmin)) && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Private Karten {myTeam === 'orange' ? 'Orange' : myTeam === 'blue' ? 'Blau' : '(Admin Ansicht)'}</h2>
              </div>
              <div className="space-y-4">
                {(role === 'orange' || role === 'admin') && (
                  <div className={role === 'admin' ? "p-3 bg-orange-50 rounded-lg" : ""}>
                    {role === 'admin' && <h3 className="font-bold text-orange-600 mb-2">Team Orange</h3>}
                    {gameState.privateOrange.length === 0 && <p className="text-sm text-gray-400">Keine privaten Karten.</p>}
                    <div className="grid grid-cols-1 gap-3">
                      {gameState.privateOrange.map((card, i) => {
                        const visible = isCardVisible(i) || role === 'admin';
                        if (!visible) return <div key={`locked-${i}`} className="p-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center space-x-2 text-gray-500"><EyeOff size={18} /> <span>Freischaltung nach {i === 1 ? '2' : '4'}h</span></div>;
                        return renderCard(card, 'Privat Orange', 'privateOrange', 'bg-orange-100', 'text-orange-900');
                      })}
                    </div>
                  </div>
                )}
                {(role === 'blue' || role === 'admin') && (
                  <div className={role === 'admin' ? "p-3 bg-blue-50 rounded-lg" : ""}>
                    {role === 'admin' && <h3 className="font-bold text-blue-600 mb-2">Team Blau</h3>}
                    {gameState.privateBlue.length === 0 && <p className="text-sm text-gray-400">Keine privaten Karten.</p>}
                    <div className="grid grid-cols-1 gap-3">
                      {gameState.privateBlue.map((card, i) => {
                        const visible = isCardVisible(i) || role === 'admin';
                        if (!visible) return <div key={`locked-${i}`} className="p-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center space-x-2 text-gray-500"><EyeOff size={18} /> <span>Freischaltung nach {i === 1 ? '2' : '4'}h</span></div>;
                        return renderCard(card, 'Privat Blau', 'privateBlue', 'bg-blue-100', 'text-blue-900');
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MIDDLE COLUMN */}
        <div className="md:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center">
                Offene Bezirke <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">{gameState.openCards.length}/4</span>
              </h2>
            </div>
            {gameState.openCards.length === 0 && <p className="text-gray-500 text-center py-6">Keine offenen Bezirke vorhanden.</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {gameState.openCards.map(card => renderCard(card, 'Offene Bezirke', 'openCards', 'bg-green-100 border-green-200', 'text-green-900'))}
            </div>
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="font-bold mb-3 flex justify-between items-center">
                Ziehstapel <span className="text-sm text-gray-500 font-normal">{gameState.deck.length} Karten übrig</span>
              </h3>
              <div className="flex flex-col space-y-2">
                <button onClick={() => handleDrawCard('openCards', 'Offene Bezirke')} disabled={gameState.openCards.length >= 4 || gameState.status !== 'active'} className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center space-x-2">
                  <PlusCircle size={16} /> <span>Neue Offene Karte ziehen</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
             <h2 className="text-xl font-bold mb-4">Geclaimte Bezirke</h2>
             <div className="space-y-4">
               <div>
                  <h3 className="text-sm font-bold text-orange-600 mb-1">Orange ({gameState.claimedOrange.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {gameState.claimedOrange.length === 0 ? <span className="text-xs text-gray-400">Noch keine</span> : null}
                    {gameState.claimedOrange.map(c => (
                      <span key={c} className="bg-orange-500 text-white text-xs px-2 py-1 rounded flex items-center space-x-1">
                        <Check size={12}/> <span>{c}</span>
                        {role === 'admin' && (
                          <button onClick={() => handleUnclaimCard(c, 'orange')} className="ml-1 hover:text-red-200 bg-white/20 rounded-full p-0.5 transition-colors" title="Claim rückgängig machen">
                            <X size={12}/>
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
               </div>
               <div>
                  <h3 className="text-sm font-bold text-blue-600 mb-1">Blau ({gameState.claimedBlue.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {gameState.claimedBlue.length === 0 ? <span className="text-xs text-gray-400">Noch keine</span> : null}
                    {gameState.claimedBlue.map(c => (
                      <span key={c} className="bg-blue-500 text-white text-xs px-2 py-1 rounded flex items-center space-x-1">
                        <Check size={12}/> <span>{c}</span>
                        {role === 'admin' && (
                          <button onClick={() => handleUnclaimCard(c, 'blue')} className="ml-1 hover:text-red-200 bg-white/20 rounded-full p-0.5 transition-colors" title="Claim rückgängig machen">
                            <X size={12}/>
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
               </div>
             </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="md:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 h-80 flex flex-col">
            <h2 className="text-lg font-bold mb-3 flex items-center space-x-2">
              <History size={18} /> <span>Spielverlauf</span>
            </h2>
            <div className="flex-1 overflow-y-auto space-y-3 text-sm pr-2">
              {[...gameState.logs].reverse().map((log, i) => (
                <div key={i} className="flex flex-col border-b border-gray-50 pb-2">
                  <span className="text-xs text-gray-400 font-mono">{log.time}</span>
                  <span className="text-gray-800">{log.msg}</span>
                </div>
              ))}
              {gameState.logs.length === 0 && <p className="text-gray-400 italic">Noch keine Aktionen.</p>}
            </div>
          </div>

          {role === 'admin' && (
            <div className="bg-gray-800 text-white rounded-2xl shadow-sm p-5 space-y-6">
              <h2 className="text-lg font-bold flex items-center space-x-2 border-b border-gray-700 pb-2">
                <Settings size={18} /> <span>Admin Tools</span>
              </h2>
              
              <form onSubmit={handleAdminAddCard} className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-300">Fehlende Karte hinzufügen</h3>
                <input type="text" value={newCardName} onChange={e => setNewCardName(e.target.value)} placeholder="Bezirk Name..." className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400" />
                <div className="flex space-x-2">
                  <select value={newCardTarget} onChange={e => setNewCardTarget(e.target.value)} className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white">
                    <option value="deck">Zu Stapel</option>
                    <option value="openCards">Zu Offen</option>
                    <option value="privateOrange">Zu Privat Orange</option>
                    <option value="privateBlue">Zu Privat Blau</option>
                  </select>
                  <button type="submit" className="bg-green-600 hover:bg-green-500 px-3 py-2 rounded text-sm font-bold">Add</button>
                </div>
              </form>

              <div className="space-y-3 pt-4 border-t border-gray-700">
                <h3 className="text-sm font-semibold text-gray-300">Spielzeit ändern</h3>
                <form onSubmit={handleSetTime} className="flex space-x-2">
                  <input type="number" min="0" placeholder="Std" value={editHours} onChange={(e) => setEditHours(e.target.value)} className="w-1/3 p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 text-center" />
                  <input type="number" min="0" placeholder="Min" value={editMinutes} onChange={(e) => setEditMinutes(e.target.value)} className="w-1/3 p-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 text-center" />
                  <button type="submit" className="w-1/3 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-bold transition-colors">Setzen</button>
                </form>
                <div className="flex space-x-2">
                  <button onClick={() => timeTravel(2)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-xs py-2 rounded">+2h vorspulen</button>
                  <button onClick={() => updateGame({startTime: Date.now()}, "Admin hat die Zeit zurückgesetzt")} className="flex-1 bg-gray-700 hover:bg-gray-600 text-xs py-2 rounded">Reset Timer</button>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-gray-700">
                <h3 className="text-sm font-semibold text-gray-300">Spiel Status</h3>
                <div className="flex space-x-2">
                  <button onClick={togglePause} className={`flex-1 py-2 rounded text-sm font-bold flex items-center justify-center space-x-1 ${gameState.status === 'paused' ? 'bg-green-600 hover:bg-green-500' : 'bg-yellow-600 hover:bg-yellow-500'}`}>
                    {gameState.status === 'paused' ? <><Play size={16}/><span>Fortsetzen</span></> : <><Pause size={16}/><span>Pausieren</span></>}
                  </button>
                  {confirmEnd ? (
                    <div className="flex-1 flex space-x-1">
                      <button onClick={handleEndGame} className="flex-1 bg-red-700 hover:bg-red-600 py-2 rounded text-xs font-bold text-white">Sicher?</button>
                      <button onClick={() => setConfirmEnd(false)} className="flex-1 bg-gray-500 hover:bg-gray-400 py-2 rounded text-xs font-bold text-white">Abbruch</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmEnd(true)} className="flex-1 py-2 rounded text-sm font-bold flex items-center justify-center space-x-1 bg-red-600 hover:bg-red-500 text-white">
                      <StopCircle size={16}/><span>Beenden (Reset)</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-gray-700">
                <h3 className="text-sm font-semibold text-gray-300">Ansicht</h3>
                <label className="flex items-center space-x-2 text-sm text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={blindAdmin} onChange={e => setBlindAdmin(e.target.checked)} className="rounded" />
                  <span>Geheime Daten verbergen (Mitspieler)</span>
                </label>
              </div>

              {!blindAdmin && (
                <>
                  <form onSubmit={handleChangePasswords} className="space-y-3 pt-4 border-t border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-300">Passwörter ändern</h3>
                    <input type="text" value={passAdmin} onChange={e => setPassAdmin(e.target.value)} placeholder={`Admin (${gameState.passwords.admin})`} className="w-full p-2 bg-gray-700 rounded text-xs text-white" />
                    <input type="text" value={passOrange} onChange={e => setPassOrange(e.target.value)} placeholder={`Orange (${gameState.passwords.orange})`} className="w-full p-2 bg-gray-700 rounded text-xs text-white" />
                    <input type="text" value={passBlue} onChange={e => setPassBlue(e.target.value)} placeholder={`Blau (${gameState.passwords.blue})`} className="w-full p-2 bg-gray-700 rounded text-xs text-white" />
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded text-sm font-bold">Speichern</button>
                  </form>

                  <div className="space-y-3 pt-4 border-t border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-300">Karten Übersicht</h3>
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 mb-1">Im Stapel ({gameState.deck.length})</h4>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto bg-gray-900 p-2 rounded border border-gray-700">
                        {gameState.deck.length === 0 && <span className="text-xs text-gray-500">Stapel ist leer.</span>}
                        {gameState.deck.map((c, i) => (
                          <span key={i} className="bg-gray-700 text-gray-200 text-xs pl-2 pr-1 py-1 rounded flex items-center space-x-1">
                            <span>{c}</span>
                            <button onClick={() => handleDeleteFromDeck(c)} className="text-gray-400 hover:text-red-400 p-0.5 rounded-full hover:bg-gray-600 transition-colors" title="Aus Stapel löschen"><X size={12} /></button>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-red-400 mb-1">Gelöscht ({(gameState.deletedCards || []).length})</h4>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto bg-gray-900 p-2 rounded border border-gray-700">
                        {(gameState.deletedCards || []).length === 0 && <span className="text-xs text-gray-500">Keine gelöschten Karten.</span>}
                        {(gameState.deletedCards || []).map((c, i) => (
                          <span key={`del-${i}`} className="bg-red-900 text-red-200 text-xs px-2 py-1 rounded">{c}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

            </div>
          )}

        </div>
      </main>
    </div>
  );
}