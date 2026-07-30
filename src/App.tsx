import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, arrayUnion, deleteDoc } from 'firebase/firestore';
import { 
  Trash2, Undo2, Check, PlusCircle, Settings, LogOut, Train, Bus, Navigation,
  Clock, RefreshCw, EyeOff, History, X, Pencil, Pause, Play, StopCircle, Wifi, WifiOff, HelpCircle, RotateCcw
} from 'lucide-react';

// --- Firebase Configuration ---
let firebaseConfig = {
  apiKey: "AIzaSyCdnUmQvuzURBA1bZAkhyFh2MvuHKgx32M",
  authDomain: "stadtbezirk-scramble-32d93.firebaseapp.com",
  projectId: "stadtbezirk-scramble-32d93",
  storageBucket: "stadtbezirk-scramble-32d93.firebasestorage.app",
  messagingSenderId: "359696096464",
  appId: "1:359696096464:web:9e14dea7f0ce887a0052d5"
};
let currentAppId = 'bezirk-scramble';

if (typeof __firebase_config !== 'undefined') {
  firebaseConfig = JSON.parse(__firebase_config);
  currentAppId = typeof __app_id !== 'undefined' ? __app_id : currentAppId;
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = currentAppId;

// --- Game Constants ---
const INITIAL_PASSWORDS = { admin: "Hello World", orange: "Cat behaviour", blue: "Schlumpf123" };
const TRANSPORT_COSTS = { sbahn: 200, ubahn: 150, bus: 50, tram: 50 };
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

// --- STYLING CONSTANTS (NEO-BRUTALISM) ---
const panelStyle = "bg-white rounded-3xl border-4 border-black p-5 shadow-[8px_8px_0_0_rgba(0,0,0,1)]";
const btnBase = "font-black border-2 border-black rounded-xl shadow-[3px_3px_0_0_rgba(0,0,0,1)] transition-all active:shadow-none active:translate-y-[3px] active:translate-x-[3px] disabled:opacity-50 disabled:shadow-none disabled:translate-y-[3px] disabled:translate-x-[3px] disabled:cursor-not-allowed flex items-center justify-center space-x-2";

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
  const [errorMessage, setErrorMessage] = useState("");
  
  const [showTutorial, setShowTutorial] = useState(false);
  const [blindAdmin, setBlindAdmin] = useState(true);

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

  const showError = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(""), 3000);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth Error:", err); }
    };
    initAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => { setUser(u); if (!u) setLoading(false); });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribeDB = onSnapshot(docRef, (snap) => {
      if (snap.exists()) setGameState(snap.data()); else setGameState(null);
      setLoading(false);
    }, (err) => { console.error("Firestore Error:", err); setLoading(false); });
    const unsubscribeLobby = onSnapshot(lobbyRef, (snap) => {
      if (snap.exists()) setLobbyState(snap.data()); else setLobbyState({ readyOrange: false, readyBlue: false });
    });
    return () => { unsubscribeDB(); unsubscribeLobby(); };
  }, [user]);

  useEffect(() => {
    if (!gameState && lobbyState?.readyOrange && lobbyState?.readyBlue) initializeGame();
  }, [lobbyState, gameState]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  const getActiveElapsedMs = () => {
    if (!gameState) return 0;
    if (gameState.status === 'paused' && gameState.pausedAt) return Math.max(0, gameState.pausedAt - gameState.startTime);
    if (gameState.status === 'ended' && gameState.endedAt) return Math.max(0, gameState.endedAt - gameState.startTime);
    return Math.max(0, now - gameState.startTime);
  };

  const getCurrentBonus = () => {
    if (!gameState) return 0;
    return Math.floor(getActiveElapsedMs() / (2 * 60 * 60 * 1000)) * 1000;
  };

  const getCalculatedPoints = (team) => gameState ? gameState.points[team] + getCurrentBonus() : 0;

  const logAction = (msg) => ({ time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), msg });

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError("");
    const pwLower = loginPassword.toLowerCase().trim();
    
    const easterEggs = {
      "42": "42 ist wohl doch nicht die Lösung für das Leben, das Universum und den ganzen Rest...",
      "passwort": "Wirklich? \"passwort\"?",
      "max": "Wer das liest ist dumm!",
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
    const initialState = {
      startTime: Date.now(), status: 'active', pausedAt: null, endedAt: null, passwords: INITIAL_PASSWORDS,
      points: { orange: 3000, blue: 3000 }, deck: shuffledDeck, openCards: shuffledDeck.splice(0, 4),
      privateOrange: shuffledDeck.splice(0, 3), privateBlue: shuffledDeck.splice(0, 3),
      claimedOrange: [], claimedBlue: [], deletedCards: [], logs: [logAction("Spiel wurde gestartet.")]
    };
    await setDoc(docRef, initialState);
    await setDoc(lobbyRef, { readyOrange: false, readyBlue: false });
  };

  const updateGame = async (updates, logMsg) => {
    if (!gameState) return;
    try {
      const payload = { ...updates };
      if (logMsg) payload.logs = arrayUnion(logAction(logMsg));
      await updateDoc(docRef, payload);
    } catch (err) { console.error("Update Error:", err); }
  };

  const handleUnclaimCard = (card, team) => {
    const teamClaimedField = team === 'orange' ? 'claimedOrange' : 'claimedBlue';
    updateGame({ [teamClaimedField]: gameState[teamClaimedField].filter(c => c !== card), deck: [...gameState.deck, card] }, `Admin hat Claim von "${card}" (${team}) rückgängig gemacht.`);
  };

  const handleClaimCard = (card, team, listKey) => {
    if (gameState.status !== 'active' && role !== 'admin') return;
    const newList = gameState[listKey].filter(c => c !== card);
    const teamClaimedField = team === 'orange' ? 'claimedOrange' : 'claimedBlue';
    let newDeck = [...gameState.deck];
    let updates = { [listKey]: newList, [teamClaimedField]: [...(gameState[teamClaimedField] || []), card] };
    if (listKey === 'openCards' && newDeck.length > 0 && newList.length < 4) { newList.push(newDeck.shift()); updates.deck = newDeck; }
    updateGame(updates, `Team ${team === 'orange' ? 'Orange' : 'Blau'} claimt Bezirk ${card}.`);
  };

  const handleDeleteCard = (card, sourceName, listKey) => {
    if (role !== 'admin') return;
    updateGame({ [listKey]: (gameState[listKey] || []).filter(c => c !== card), deletedCards: [...(gameState.deletedCards || []), card] }, `Admin hat "${card}" ersatzlos gelöscht.`);
  };

  const handleReplaceCard = (card, listKey) => {
    if (gameState.status !== 'active' && role !== 'admin') return;
    if (gameState.deck.length === 0) return showError("Der Stapel ist leer!");
    const newDeck = [...gameState.deck];
    const teamCards = [...gameState[listKey]];
    const cardIndex = teamCards.indexOf(card);
    if (cardIndex > -1) teamCards[cardIndex] = newDeck.shift(); 
    updateGame({ deck: newDeck, [listKey]: teamCards, deletedCards: [...(gameState.deletedCards || []), card] }, `Bezirk "${card}" wurde ersetzt/gelöscht.`);
  };

  const handleReturnRandomToDeck = (card, listKey) => {
    if (gameState.status !== 'active' && role !== 'admin') return;
    if (gameState.deck.length === 0) return showError("Der Stapel ist leer!");
    const newDeck = [...gameState.deck];
    const newList = [...gameState[listKey]];
    const cardIndex = newList.indexOf(card);
    if (cardIndex > -1) newList[cardIndex] = newDeck.shift(); 
    newDeck.splice(Math.floor(Math.random() * (newDeck.length + 1)), 0, card);
    updateGame({ deck: newDeck, [listKey]: newList }, `Offener Bezirk "${card}" wurde zurückgemischt & neu gezogen.`);
  };

  const handleRestoreDeletedToDeck = (card) => {
    if (role !== 'admin') return;
    const currentDeleted = gameState.deletedCards || [];
    const newDeck = [...gameState.deck];
    newDeck.splice(Math.floor(Math.random() * (newDeck.length + 1)), 0, card);
    updateGame({ deletedCards: currentDeleted.filter(c => c !== card), deck: newDeck }, `Admin hat "${card}" zurück in Stapel gemischt.`);
  };

  const handleRestoreAllDeletedToDeck = () => {
    if (role !== 'admin') return;
    const currentDeleted = gameState.deletedCards || [];
    if (currentDeleted.length === 0) return;
    const newDeck = [...gameState.deck];
    currentDeleted.forEach(card => newDeck.splice(Math.floor(Math.random() * (newDeck.length + 1)), 0, card));
    updateGame({ deletedCards: [], deck: newDeck }, `Admin hat alle gelöschten Karten zurückgemischt.`);
  };

  const handleDrawCard = (targetList, logName) => {
    if (gameState.status !== 'active' && role !== 'admin') return;
    if (gameState.deck.length === 0) return showError("Der Stapel ist leer!");
    const newDeck = [...gameState.deck];
    updateGame({ deck: newDeck, [targetList]: [...gameState[targetList], newDeck.shift()] }, `Karte gezogen für: ${logName}`);
  };

  const handleTransportDeduction = (team, type, cost) => {
    if (gameState.status !== 'active' && role !== 'admin') return;
    updateGame({ points: { ...gameState.points, [team]: gameState.points[team] - cost } }, `Team ${team === 'orange' ? 'Orange' : 'Blau'} nutzt ${type} (-${cost} Punkte).`);
  };

  // --- Admin Methods ---
  const handleAdminAddCard = (e) => {
    e.preventDefault();
    if (!newCardName.trim()) return;
    updateGame({ [newCardTarget]: [...gameState[newCardTarget], newCardName.trim()] }, `Admin hat "${newCardName}" zu [${newCardTarget}] hinzugefügt.`);
    setNewCardName("");
  };

  const handleDeleteFromDeck = (card) => {
    updateGame({ deck: gameState.deck.filter(c => c !== card), deletedCards: [...(gameState.deletedCards || []), card] }, `Admin hat "${card}" aus Stapel gelöscht.`);
  };

  const handleChangePasswords = (e) => {
    e.preventDefault();
    updateGame({ passwords: { admin: passAdmin || gameState.passwords.admin, orange: passOrange || gameState.passwords.orange, blue: passBlue || gameState.passwords.blue } }, "Admin hat Passwörter aktualisiert.");
    setPassAdmin(""); setPassOrange(""); setPassBlue("");
  };

  const handleSavePoints = () => {
    if (pointEditTeam && pointEditValue !== "") {
      const targetValue = parseInt(pointEditValue, 10);
      if (!isNaN(targetValue)) {
        updateGame({ points: { ...gameState.points, [pointEditTeam]: targetValue - getCurrentBonus() } }, `Admin setzte Punkte von Team ${pointEditTeam} auf ${targetValue}.`);
      }
    }
    setPointEditTeam(null); setPointEditValue("");
  };

  const timeTravel = (hours) => updateGame({ startTime: gameState.startTime - (hours * 60 * 60 * 1000) }, `Admin: Spielzeit +${hours} Stunden.`);

  const handleSetTime = (e) => {
    e.preventDefault();
    const h = parseInt(editHours || "0", 10);
    const m = parseInt(editMinutes || "0", 10);
    if (!isNaN(h) && !isNaN(m)) {
      const targetElapsedMs = (h * 60 * 60 * 1000) + (m * 60 * 1000);
      let newStartTime = Date.now() - targetElapsedMs;
      if (gameState.status === 'paused' && gameState.pausedAt) newStartTime = gameState.pausedAt - targetElapsedMs;
      else if (gameState.status === 'ended' && gameState.endedAt) newStartTime = gameState.endedAt - targetElapsedMs;
      updateGame({ startTime: newStartTime }, `Admin hat Zeit auf ${h} Stunden ${m} Minuten gesetzt.`);
      setEditHours(""); setEditMinutes("");
    }
  };

  const togglePause = () => {
    if (gameState.status === 'paused') updateGame({ status: 'active', pausedAt: null, startTime: gameState.startTime + (Date.now() - gameState.pausedAt) }, "Spiel fortgesetzt.");
    else updateGame({ status: 'paused', pausedAt: Date.now() }, "Spiel pausiert.");
  };

  const toggleEnd = () => {
    if (gameState.status === 'ended') updateGame({ status: 'active', endedAt: null, startTime: gameState.startTime + (Date.now() - gameState.endedAt) }, "Spiel wieder aufgenommen.");
    else updateGame({ status: 'ended', endedAt: Date.now() }, "Spiel beendet.");
  };

  const handleEndGame = async () => {
    try { await deleteDoc(docRef); await setDoc(lobbyRef, { readyOrange: false, readyBlue: false }); setConfirmEnd(false); } 
    catch (err) { console.error("End Game Error:", err); }
  };

  const isCardVisible = (index) => {
    if (!gameState) return false;
    const elapsedMs = getActiveElapsedMs();
    if (index === 0) return true; 
    if (index === 1) return elapsedMs >= 2 * 60 * 60 * 1000; 
    if (index >= 2) return elapsedMs >= 4 * 60 * 60 * 1000; 
    return false;
  };

  const renderCard = (card, sourceName, listKey, colorClass = "bg-white") => {
    const isPrivate = listKey === 'privateOrange' || listKey === 'privateBlue';
    const isMyPrivateCard = (role === 'orange' && listKey === 'privateOrange') || (role === 'blue' && listKey === 'privateBlue');
    const canClaim = listKey === 'openCards' || isMyPrivateCard;
    
    return (
      <div key={card} className={`p-4 rounded-2xl border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] flex flex-col justify-between space-y-4 relative transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_0_rgba(0,0,0,1)] ${colorClass} text-black`}>
        <div className="font-black text-xl text-center leading-tight tracking-wide uppercase">{card}</div>
        
        <div className="flex flex-col space-y-3">
          {role === 'admin' && listKey === 'openCards' && (
            <div className="flex space-x-2">
              <button onClick={() => handleClaimCard(card, 'orange', listKey)} className={`${btnBase} flex-1 py-1 bg-[#ff9800] text-black text-sm`}>Orange</button>
              <button onClick={() => handleClaimCard(card, 'blue', listKey)} className={`${btnBase} flex-1 py-1 bg-[#2196f3] text-black text-sm`}>Blau</button>
            </div>
          )}

          {(role === 'orange' || role === 'blue') && canClaim && (
            <button 
              disabled={gameState.status !== 'active'}
              onClick={() => handleClaimCard(card, role, listKey)}
              className={`${btnBase} w-full py-2 bg-[#bbf7d0] hover:bg-[#86efac] text-black text-sm`}
            >
              <Check size={18} strokeWidth={3} /> <span>CLAIM</span>
            </button>
          )}

          <div className="flex justify-between items-center space-x-2">
            {role === 'admin' && (
              <button onClick={() => handleDeleteCard(card, sourceName, listKey)} className="p-2 bg-red-400 text-black border-2 border-black rounded-lg shadow-[2px_2px_0_0_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all">
                <Trash2 size={18} strokeWidth={2.5}/>
              </button>
            )}
            
            {!isPrivate && (
              <button 
                disabled={gameState.status !== 'active' && role !== 'admin'}
                onClick={() => handleReturnRandomToDeck(card, listKey)}
                className="p-2 bg-[#fde047] text-black border-2 border-black rounded-lg shadow-[2px_2px_0_0_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all disabled:opacity-50" title="Zurück in Stapel">
                <Undo2 size={18} strokeWidth={2.5}/>
              </button>
            )}

            {!isPrivate && (
              <button 
                disabled={gameState.status !== 'active' && role !== 'admin'}
                onClick={() => handleReplaceCard(card, listKey)}
                className="p-2 bg-[#e879f9] text-black border-2 border-black rounded-lg shadow-[2px_2px_0_0_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all disabled:opacity-50" title="Ersetzen (Löschen & Neu)">
                <RefreshCw size={18} strokeWidth={2.5}/>
              </button>
            )}
            
            {isPrivate && (
              <button 
                disabled={gameState.status !== 'active' && role !== 'admin'}
                onClick={() => handleReplaceCard(card, listKey)}
                className={`${btnBase} flex-1 py-1.5 bg-white text-black text-xs hover:bg-gray-100`}>
                <RefreshCw size={14} strokeWidth={3}/> <span>ERSETZEN</span>
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
    if (elapsedMs < 0) return "0 Stunden 0 Minuten";
    const h = Math.floor(elapsedMs / (1000 * 60 * 60));
    const m = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m`;
  };

  // --- VIEWS ---
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#fdf8f5]"><RefreshCw className="animate-spin text-black" size={48} strokeWidth={3} /></div>;

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdf8f5] p-4 text-black font-sans">
        <div className="bg-white p-8 rounded-3xl border-4 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] max-w-sm w-full">
          <h1 className="text-3xl font-black mb-8 text-center uppercase tracking-tight">Bezirk<br/><span className="text-[#6366f1]">Scramble</span></h1>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-bold mb-2 uppercase">Passwort eingeben</label>
              <input 
                type="password" 
                value={loginPassword} 
                onChange={e => setLoginPassword(e.target.value)}
                className="w-full border-4 border-black rounded-xl p-3 outline-none focus:bg-[#fef08a] font-bold transition-colors"
                placeholder="*********"
              />
            </div>
            {loginError && <p className="text-red-500 text-sm font-bold bg-red-100 p-2 rounded border-2 border-red-500">{loginError}</p>}
            <button type="submit" className={`${btnBase} w-full py-4 bg-[#6366f1] text-white text-lg hover:bg-[#4f46e5]`}>
              LOS GEHT'S!
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!gameState && role === 'admin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdf8f5] p-4 text-black font-sans">
        <h1 className="text-4xl font-black mb-4 uppercase tracking-tight">Admin <span className="text-red-500">Zentrale</span></h1>
        <p className="mb-6 font-bold text-lg text-gray-600 border-b-4 border-black pb-4">Spiel nicht gestartet.</p>
        <div className="flex space-x-4 mb-8">
          <div className={`px-6 py-3 rounded-2xl font-black text-lg flex items-center space-x-2 border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] ${lobbyState?.readyOrange ? 'bg-[#ff9800] text-black' : 'bg-gray-100 text-gray-400'}`}>
            <Check size={24} strokeWidth={3} className={lobbyState?.readyOrange ? 'opacity-100' : 'opacity-0'} /> <span>ORANGE</span>
          </div>
          <div className={`px-6 py-3 rounded-2xl font-black text-lg flex items-center space-x-2 border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] ${lobbyState?.readyBlue ? 'bg-[#2196f3] text-black' : 'bg-gray-100 text-gray-400'}`}>
            <Check size={24} strokeWidth={3} className={lobbyState?.readyBlue ? 'opacity-100' : 'opacity-0'} /> <span>BLAU</span>
          </div>
        </div>
        <button onClick={initializeGame} className={`${btnBase} py-4 px-8 bg-[#4ade80] text-black text-xl hover:bg-[#22c55e]`}>
          <Play size={28} strokeWidth={3}/> <span>SPIEL ERZWINGEN</span>
        </button>
      </div>
    );
  }

  if (!gameState && role !== 'admin') {
    const isReady = role === 'orange' ? lobbyState?.readyOrange : lobbyState?.readyBlue;
    const otherReady = role === 'orange' ? lobbyState?.readyBlue : lobbyState?.readyOrange;
    const setReadyState = async (state) => await setDoc(lobbyRef, { [role === 'orange' ? 'readyOrange' : 'readyBlue']: state }, { merge: true });

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdf8f5] p-4 select-none text-black font-sans">
        <div className="bg-white p-8 rounded-3xl border-4 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] max-w-sm w-full text-center flex flex-col items-center">
          <RefreshCw size={56} strokeWidth={3} className={`mx-auto mb-6 ${isReady && otherReady ? 'text-[#4ade80] animate-spin' : 'text-black animate-pulse'}`} />
          <h2 className="text-3xl font-black mb-2 uppercase tracking-tight">Warteraum</h2>
          <p className="font-bold mb-8">
            Team {role === 'orange' ? <span className="text-[#ff9800] text-xl uppercase">Orange</span> : <span className="text-[#2196f3] text-xl uppercase">Blau</span>}<br/><br/>
            Halte den Button gedrückt, bis beide Teams bereit sind!
          </p>
          <div className="w-full space-y-4 mb-8">
            <button 
              onPointerDown={() => setReadyState(true)} onPointerUp={() => setReadyState(false)} onPointerLeave={() => setReadyState(false)} onContextMenu={(e) => e.preventDefault()}
              className={`w-full font-black text-xl py-8 rounded-2xl border-4 border-black transition-all touch-none select-none ${isReady ? 'bg-[#4ade80] text-black shadow-none translate-y-[4px]' : 'bg-[#facc15] text-black shadow-[6px_6px_0_0_rgba(0,0,0,1)]'}`}
            >
              {isReady ? <span className="flex justify-center items-center space-x-2"><Check size={28} strokeWidth={3}/><span>HALTEN...</span></span> : <span>GEDRÜCKT HALTEN!</span>}
            </button>
            <div className="text-sm font-bold bg-gray-100 p-3 rounded-xl border-2 border-black flex justify-between items-center">
              <span className="uppercase">Team {role === 'orange' ? 'Blau' : 'Orange'}:</span>
              <span className={`px-2 py-1 rounded text-xs border-2 border-black ${otherReady ? 'bg-[#4ade80] animate-pulse' : 'bg-white'}`}>
                {otherReady ? 'HÄLT GEDRÜCKT!' : 'WARTET...'}
              </span>
            </div>
          </div>
          <button onClick={() => setRole(null)} className="font-black text-gray-500 uppercase hover:text-black transition-colors">Abmelden</button>
        </div>
      </div>
    );
  }

  const myTeam = role === 'admin' ? null : role;

  return (
    <div className="min-h-screen bg-[#fdf8f5] flex flex-col text-black font-sans">
      
      {errorMessage && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 bg-[#ef4444] border-4 border-black text-white px-6 py-3 rounded-2xl shadow-[6px_6px_0_0_rgba(0,0,0,1)] z-50 font-black text-lg flex items-center space-x-3">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage("")} className="hover:bg-red-700 p-1 rounded-full"><X size={20} strokeWidth={3}/></button>
        </div>
      )}

      {/* Tutorial Modal */}
      {showTutorial && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border-4 border-black shadow-[12px_12px_0_0_rgba(255,255,255,1)] max-w-lg w-full max-h-[90vh] flex flex-col text-black">
            <div className="p-5 border-b-4 border-black flex justify-between items-center bg-[#fde047] rounded-t-[20px]">
              <h2 className="text-2xl font-black uppercase tracking-tight flex items-center space-x-2">
                <HelpCircle size={28} strokeWidth={3}/> <span>Tutorial</span>
              </h2>
              <button onClick={() => setShowTutorial(false)} className="p-2 hover:bg-yellow-500 rounded-full transition-colors border-2 border-transparent hover:border-black"><X size={24} strokeWidth={3}/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6 font-medium text-base">
               <div><h3 className="font-black text-xl border-b-4 border-black inline-block mb-3 uppercase">Ziel des Spiels</h3><p>Sammle die meisten an sich aneinander angrenzenden Bezirke!</p></div>
               <div>
                 <h3 className="font-black text-xl border-b-4 border-black inline-block mb-3 uppercase">Die Benutzeroberfläche</h3>
                 <ul className="space-y-4">
                    <li className="flex gap-3"><Train className="text-[#2196f3] shrink-0" size={24} strokeWidth={3}/><span><strong>Transport:</strong> Klickt auf S-Bahn, U-Bahn, Bus, Tram, um Fahrtkosten direkt von euren Punkten abzuziehen.</span></li>
                    <li className="flex gap-3"><Check className="text-[#4ade80] shrink-0" size={24} strokeWidth={3}/><span><strong>Claimen:</strong> Klickt auf "Claimen", wenn ihr die Challenge für einen Bezirk erfüllt habt.</span></li>
                    <li className="flex gap-3"><EyeOff className="text-gray-500 shrink-0" size={24} strokeWidth={3}/><span><strong>Private Karten:</strong> Ihr habt 3 eigene Bezirke (Freischaltung: sofort, nach 2 Stunden, nach 4 Stunden).</span></li>
                    <li className="flex gap-3"><RefreshCw className="text-[#e879f9] shrink-0" size={24} strokeWidth={3}/><span><strong>Ersetzen:</strong> Wenn eine Challenge nicht absolvierbar ist, löscht sie und zieht eine neue Karte nach.</span></li>
                 </ul>
               </div>
               <div><h3 className="font-black text-xl border-b-4 border-black inline-block mb-3 uppercase">Punkte & Zeit</h3><p>Start: <strong>3000 Punkte</strong>. Alle 2 Stunden gibt es <strong>+1000 Punkte</strong> Bonus.</p></div>
            </div>
            <div className="p-5 border-t-4 border-black bg-gray-50 rounded-b-[20px]">
              <button onClick={() => setShowTutorial(false)} className={`${btnBase} w-full py-4 bg-[#6366f1] text-white text-xl hover:bg-[#4f46e5]`}>ALLES KLAR!</button>
            </div>
          </div>
        </div>
      )}

      <header className={`px-6 py-4 border-b-4 border-black shadow-[0_4px_0_0_rgba(0,0,0,1)] flex justify-between items-center z-10 relative ${role === 'admin' ? 'bg-black text-white' : role === 'orange' ? 'bg-[#ff9800] text-black' : 'bg-[#2196f3] text-black'}`}>
        <div className="flex items-center space-x-3">
          <Navigation size={28} strokeWidth={3} className={role === 'admin' ? 'text-white' : 'text-black'} />
          <h1 className="text-2xl font-black uppercase tracking-widest hidden sm:block">Scramble</h1>
        </div>
        
        <div className="flex space-x-4 sm:space-x-6 items-center text-sm font-bold">
          <div className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl border-2 ${role==='admin' ? 'border-gray-600':'border-black'} ${isOnline ? (role==='admin'?'bg-gray-800 text-green-400':'bg-white/30 text-black') : 'bg-red-500 text-white animate-pulse'}`}>
            {isOnline ? <Wifi size={16} strokeWidth={3} /> : <WifiOff size={16} strokeWidth={3} />}
            <span className="hidden sm:inline uppercase">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          <button onClick={() => setShowTutorial(true)} className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl border-2 ${role==='admin' ? 'border-gray-600 hover:bg-gray-800':'border-black hover:bg-white/30'} transition-colors`}>
            <HelpCircle size={18} strokeWidth={2.5} /> <span className="hidden sm:inline uppercase">Tutorial</span>
          </button>

          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border-2 ${role==='admin' ? 'border-gray-600 bg-gray-800':'border-black bg-white/40 shadow-[2px_2px_0_0_rgba(0,0,0,1)]'}`}>
            <Clock size={18} strokeWidth={3} />
            <span className="text-base">{getElapsedTime()}</span>
          </div>
          
          <button onClick={() => setRole(null)} className="flex items-center space-x-1 hover:opacity-70 transition-opacity">
            <LogOut size={20} strokeWidth={3} />
          </button>
        </div>
      </header>

      {gameState.status === 'paused' && <div className="bg-[#facc15] border-b-4 border-black text-black font-black text-xl tracking-widest text-center py-3 animate-pulse flex items-center justify-center space-x-2"><Pause size={24} strokeWidth={3} /> <span>SPIEL PAUSIERT</span></div>}
      {gameState.status === 'ended' && <div className="bg-red-500 border-b-4 border-black text-white font-black text-xl tracking-widest text-center py-3 flex items-center justify-center space-x-2"><StopCircle size={24} strokeWidth={3} /> <span>SPIEL BEENDET</span></div>}

      <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-4 space-y-8">
          
          {role === 'admin' && !blindAdmin && (
            <div className={panelStyle}>
              <h2 className="text-2xl font-black uppercase tracking-tight mb-5 border-b-4 border-black pb-2">Punkte</h2>
              <div className="space-y-4">
                {['orange', 'blue'].map((t) => (
                  <div key={t} className={`flex justify-between items-center p-4 rounded-xl border-4 border-black ${t === 'orange' ? 'bg-[#ffedd5]' : 'bg-[#dbeafe]'}`}>
                    <span className="font-black text-lg uppercase tracking-wide">
                      Team {t === 'orange' ? 'Orange' : 'Blau'}
                    </span>
                    {pointEditTeam === t ? (
                      <div className="flex items-center space-x-2">
                        <input type="number" className="w-24 p-2 text-lg font-bold border-2 border-black rounded-lg text-right" value={pointEditValue} onChange={(e) => setPointEditValue(e.target.value)} autoFocus />
                        <button onClick={handleSavePoints} className="bg-[#4ade80] border-2 border-black p-2 rounded-lg hover:bg-green-500"><Check size={20} strokeWidth={3}/></button>
                        <button onClick={() => setPointEditTeam(null)} className="bg-gray-300 border-2 border-black p-2 rounded-lg hover:bg-gray-400"><X size={20} strokeWidth={3}/></button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <span className="font-black text-2xl">⭐ {getCalculatedPoints(t)}</span>
                        <button onClick={() => { setPointEditTeam(t); setPointEditValue(getCalculatedPoints(t)); }} className="hover:scale-110 transition-transform bg-white border-2 border-black p-1.5 rounded-lg"><Pencil size={16} strokeWidth={3} /></button>
                      </div>
                    )}
                  </div>
                ))}
                <div className="text-sm font-bold text-gray-500 text-center uppercase tracking-wider mt-4">
                  (Inkl. +{getCurrentBonus()} Bonus)
                </div>
              </div>
            </div>
          )}

          {myTeam && (
            <div className={`${panelStyle} bg-[#f8fafc]`}>
              <h2 className="text-2xl font-black uppercase mb-5 flex justify-between items-center">
                TEAM {myTeam === 'orange' ? 'ORANGE' : 'BLAU'}
                <div className="flex flex-col items-end">
                  <span className={`border-4 border-black px-4 py-2 rounded-xl text-xl shadow-[4px_4px_0_0_rgba(0,0,0,1)] ${myTeam === 'orange' ? 'bg-[#ff9800]' : 'bg-[#2196f3]'}`}>
                    ⭐ {getCalculatedPoints(myTeam)}
                  </span>
                  {getCurrentBonus() > 0 && <span className="text-sm font-bold mt-2 text-gray-600">+ {getCurrentBonus()} Zeit-Bonus</span>}
                </div>
              </h2>
              <div className="pt-4 border-t-4 border-black">
                <p className="text-sm font-black uppercase tracking-widest mb-3">Transport nutzen</p>
                <div className="grid grid-cols-2 gap-3">
                  <button disabled={gameState.status !== 'active'} onClick={() => handleTransportDeduction(myTeam, 'S-Bahn', TRANSPORT_COSTS.sbahn)} className={`${btnBase} py-3 bg-[#4ade80] hover:bg-[#22c55e] text-black text-base`}>
                    <Train size={20} strokeWidth={3}/> <span>- {TRANSPORT_COSTS.sbahn}</span>
                  </button>
                  <button disabled={gameState.status !== 'active'} onClick={() => handleTransportDeduction(myTeam, 'U-Bahn', TRANSPORT_COSTS.ubahn)} className={`${btnBase} py-3 bg-[#60a5fa] hover:bg-[#3b82f6] text-black text-base`}>
                    <Train size={20} strokeWidth={3}/> <span>- {TRANSPORT_COSTS.ubahn}</span>
                  </button>
                  <button disabled={gameState.status !== 'active'} onClick={() => handleTransportDeduction(myTeam, 'Bus', TRANSPORT_COSTS.bus)} className={`${btnBase} py-3 bg-gray-300 hover:bg-gray-400 text-black text-base`}>
                    <Bus size={20} strokeWidth={3}/> <span>- {TRANSPORT_COSTS.bus}</span>
                  </button>
                  <button disabled={gameState.status !== 'active'} onClick={() => handleTransportDeduction(myTeam, 'Tram', TRANSPORT_COSTS.tram)} className={`${btnBase} py-3 bg-[#f87171] hover:bg-[#ef4444] text-black text-base`}>
                    <Train size={20} strokeWidth={3}/> <span>- {TRANSPORT_COSTS.tram}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {(myTeam || (role === 'admin' && !blindAdmin)) && (
            <div className={panelStyle}>
              <h2 className="text-2xl font-black uppercase tracking-tight mb-5 border-b-4 border-black pb-2">Private Karten</h2>
              <div className="space-y-6">
                {(role === 'orange' || role === 'admin') && (
                  <div className={role === 'admin' ? "p-4 bg-[#ffedd5] border-4 border-black rounded-2xl" : ""}>
                    {role === 'admin' && <h3 className="font-black text-xl mb-3 uppercase tracking-wider text-[#ea580c]">Orange</h3>}
                    <div className="grid grid-cols-1 gap-4">
                      {gameState.privateOrange.map((card, i) => {
                        const visible = isCardVisible(i) || role === 'admin';
                        if (!visible) return <div key={`locked-${i}`} className="p-5 rounded-2xl border-4 border-dashed border-gray-400 bg-gray-100 flex items-center justify-center space-x-2 font-black text-gray-400"><EyeOff size={20} strokeWidth={3}/> <span>FREISCHALTUNG: {i === 1 ? '2 STUNDEN' : '4 STUNDEN'}</span></div>;
                        return renderCard(card, 'Privat Orange', 'privateOrange', 'bg-[#fed7aa]');
                      })}
                    </div>
                  </div>
                )}
                {(role === 'blue' || role === 'admin') && (
                  <div className={role === 'admin' ? "p-4 bg-[#dbeafe] border-4 border-black rounded-2xl" : ""}>
                    {role === 'admin' && <h3 className="font-black text-xl mb-3 uppercase tracking-wider text-[#2563eb]">Blau</h3>}
                    <div className="grid grid-cols-1 gap-4">
                      {gameState.privateBlue.map((card, i) => {
                        const visible = isCardVisible(i) || role === 'admin';
                        if (!visible) return <div key={`locked-${i}`} className="p-5 rounded-2xl border-4 border-dashed border-gray-400 bg-gray-100 flex items-center justify-center space-x-2 font-black text-gray-400"><EyeOff size={20} strokeWidth={3}/> <span>FREISCHALTUNG: {i === 1 ? '2 STUNDEN' : '4 STUNDEN'}</span></div>;
                        return renderCard(card, 'Privat Blau', 'privateBlue', 'bg-[#bfdbfe]');
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MIDDLE COLUMN */}
        <div className="lg:col-span-5 space-y-8">
          <div className={`${panelStyle} bg-[#f0fdf4]`}>
            <div className="flex justify-between items-center mb-6 border-b-4 border-black pb-3">
              <h2 className="text-2xl font-black uppercase tracking-tight">Offene Bezirke</h2>
              <span className="bg-[#4ade80] border-4 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] text-black font-black text-lg px-3 py-1 rounded-xl">
                {gameState.openCards.length} / 4
              </span>
            </div>
            
            {gameState.openCards.length === 0 && <p className="font-bold text-center py-10 text-gray-500 uppercase tracking-widest border-4 border-dashed border-gray-300 rounded-2xl">Keine offenen Bezirke.</p>}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {gameState.openCards.map(card => renderCard(card, 'Offene Bezirke', 'openCards', 'bg-[#bbf7d0] border-black'))}
            </div>
            
            <div className="mt-8 pt-6 border-t-4 border-black">
              <h3 className="font-black text-xl uppercase mb-4 flex justify-between items-center">
                Ziehstapel <span className="bg-black text-white px-3 py-1 rounded-lg text-sm">{gameState.deck.length} übrig</span>
              </h3>
              <button onClick={() => handleDrawCard('openCards', 'Offene Bezirke')} disabled={gameState.openCards.length >= 4 || gameState.status !== 'active'} className={`${btnBase} w-full py-4 bg-white hover:bg-gray-100 text-black text-lg`}>
                <PlusCircle size={24} strokeWidth={3}/> <span>NEUEN BEZIRK AUFDECKEN</span>
              </button>
            </div>
          </div>

          <div className={panelStyle}>
             <h2 className="text-2xl font-black uppercase tracking-tight mb-5 border-b-4 border-black pb-2">Geclaimte Bezirke</h2>
             <div className="space-y-6">
               <div className="p-4 bg-[#ffedd5] border-4 border-black rounded-2xl">
                  <h3 className="text-lg font-black uppercase tracking-wider text-[#ea580c] mb-3">Orange ({gameState.claimedOrange.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {gameState.claimedOrange.length === 0 && <span className="text-sm font-bold text-gray-500 bg-white px-3 py-1 border-2 border-dashed border-gray-400 rounded-lg">Noch keine</span>}
                    {gameState.claimedOrange.map(c => (
                      <span key={c} className="bg-[#ff9800] border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] text-black font-bold text-sm px-3 py-1.5 rounded-lg flex items-center space-x-2">
                        <span>{c}</span>
                        {role === 'admin' && <button onClick={() => handleUnclaimCard(c, 'orange')} className="ml-1 hover:bg-white rounded-full p-0.5 transition-colors border-2 border-transparent hover:border-black"><X size={14} strokeWidth={3}/></button>}
                      </span>
                    ))}
                  </div>
               </div>
               <div className="p-4 bg-[#dbeafe] border-4 border-black rounded-2xl">
                  <h3 className="text-lg font-black uppercase tracking-wider text-[#2563eb] mb-3">Blau ({gameState.claimedBlue.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {gameState.claimedBlue.length === 0 && <span className="text-sm font-bold text-gray-500 bg-white px-3 py-1 border-2 border-dashed border-gray-400 rounded-lg">Noch keine</span>}
                    {gameState.claimedBlue.map(c => (
                      <span key={c} className="bg-[#2196f3] border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] text-black font-bold text-sm px-3 py-1.5 rounded-lg flex items-center space-x-2">
                        <span>{c}</span>
                        {role === 'admin' && <button onClick={() => handleUnclaimCard(c, 'blue')} className="ml-1 hover:bg-white rounded-full p-0.5 transition-colors border-2 border-transparent hover:border-black"><X size={14} strokeWidth={3}/></button>}
                      </span>
                    ))}
                  </div>
               </div>
             </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-3 space-y-8">
          <div className={`${panelStyle} h-96 flex flex-col`}>
            <h2 className="text-xl font-black uppercase tracking-tight mb-4 flex items-center space-x-2 border-b-4 border-black pb-2">
              <History size={24} strokeWidth={3}/> <span>Verlauf</span>
            </h2>
            <div className="flex-1 overflow-y-auto space-y-3 text-sm font-medium pr-2 custom-scrollbar">
              {[...gameState.logs].reverse().map((log, i) => (
                <div key={i} className="flex flex-col border-l-4 border-black pl-3 py-1">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{log.time}</span>
                  <span className="text-black">{log.msg}</span>
                </div>
              ))}
              {gameState.logs.length === 0 && <p className="font-bold text-gray-400 italic">Noch keine Aktionen.</p>}
            </div>
          </div>

          {role === 'admin' && (
            <div className={`${panelStyle} bg-black text-white border-none shadow-[8px_8px_0_0_rgba(100,116,139,0.5)]`}>
              <h2 className="text-2xl font-black uppercase tracking-tight flex items-center space-x-2 border-b-4 border-gray-700 pb-4 mb-5">
                <Settings size={28} strokeWidth={3}/> <span>Admin Tools</span>
              </h2>
              
              <div className="space-y-6">
                <form onSubmit={handleAdminAddCard} className="space-y-3">
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Karte Hinzufügen</h3>
                  <input type="text" value={newCardName} onChange={e => setNewCardName(e.target.value)} placeholder="Name..." className="w-full p-3 border-4 border-gray-700 bg-gray-900 rounded-xl text-white font-bold outline-none focus:border-white transition-colors" />
                  <div className="flex flex-col space-y-2 lg:flex-row lg:space-y-0 lg:space-x-2">
                    <select value={newCardTarget} onChange={e => setNewCardTarget(e.target.value)} className="flex-1 p-3 border-4 border-gray-700 bg-gray-900 rounded-xl text-white font-bold outline-none">
                      <option value="deck">Zu Stapel</option><option value="openCards">Zu Offen</option><option value="privateOrange">Zu Privat Orange</option><option value="privateBlue">Zu Privat Blau</option>
                    </select>
                    <button type="submit" className={`${btnBase} px-4 py-3 bg-[#4ade80] border-transparent text-black hover:bg-[#22c55e]`}>HINZUFÜGEN</button>
                  </div>
                </form>

                <div className="space-y-3 pt-5 border-t-4 border-gray-700">
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Zeit Ändern</h3>
                  <form onSubmit={handleSetTime} className="flex space-x-2">
                    <input type="number" min="0" placeholder="Stunden" value={editHours} onChange={(e) => setEditHours(e.target.value)} className="w-1/3 p-2 bg-gray-900 border-4 border-gray-700 rounded-xl text-center font-bold outline-none focus:border-white text-xs" />
                    <input type="number" min="0" placeholder="Minuten" value={editMinutes} onChange={(e) => setEditMinutes(e.target.value)} className="w-1/3 p-2 bg-gray-900 border-4 border-gray-700 rounded-xl text-center font-bold outline-none focus:border-white text-xs" />
                    <button type="submit" className={`${btnBase} w-1/3 bg-[#6366f1] border-transparent text-white hover:bg-[#4f46e5]`}>SETZEN</button>
                  </form>
                  <div className="flex space-x-2">
                    <button onClick={() => timeTravel(2)} className={`${btnBase} flex-1 py-3 bg-gray-800 border-transparent text-white text-xs hover:bg-gray-700`}>+2 STUNDEN VORSPULEN</button>
                    <button onClick={() => updateGame({startTime: Date.now()}, "Zeit Reset")} className={`${btnBase} flex-1 py-3 bg-gray-800 border-transparent text-white text-xs hover:bg-gray-700`}>ZURÜCKSETZEN</button>
                  </div>
                </div>

                <div className="space-y-3 pt-5 border-t-4 border-gray-700">
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Spiel Status</h3>
                  <div className="flex space-x-2">
                    <button onClick={togglePause} className={`${btnBase} flex-1 py-3 border-transparent ${gameState.status === 'paused' ? 'bg-[#4ade80] text-black hover:bg-[#22c55e]' : 'bg-[#facc15] text-black hover:bg-[#eab308]'}`}>
                      {gameState.status === 'paused' ? <><Play size={18} strokeWidth={3}/><span>WEITER</span></> : <><Pause size={18} strokeWidth={3}/><span>PAUSE</span></>}
                    </button>
                    {confirmEnd ? (
                      <div className="flex-1 flex space-x-1">
                        <button onClick={handleEndGame} className={`${btnBase} flex-1 py-3 bg-red-600 border-transparent text-white text-xs hover:bg-red-700`}>SICHER?</button>
                        <button onClick={() => setConfirmEnd(false)} className={`${btnBase} flex-1 py-3 bg-gray-600 border-transparent text-white text-xs hover:bg-gray-500`}>NEIN</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmEnd(true)} className={`${btnBase} flex-1 py-3 bg-red-600 border-transparent text-white hover:bg-red-700`}>
                        <StopCircle size={18} strokeWidth={3}/><span>BEENDEN</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3 pt-5 border-t-4 border-gray-700">
                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <div className="relative">
                      <input type="checkbox" checked={blindAdmin} onChange={e => setBlindAdmin(e.target.checked)} className="sr-only" />
                      <div className={`block w-14 h-8 rounded-full border-4 transition-colors ${blindAdmin ? 'bg-[#4ade80] border-transparent' : 'bg-gray-700 border-transparent'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${blindAdmin ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </div>
                    <span className="font-black text-sm uppercase tracking-wide text-gray-300 group-hover:text-white transition-colors">Streamer / Blind Modus</span>
                  </label>
                </div>

                {!blindAdmin && (
                  <div className="space-y-5 animate-fadeIn">
                    <form onSubmit={handleChangePasswords} className="space-y-3 pt-5 border-t-4 border-gray-700">
                      <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Passwörter</h3>
                      <input type="text" value={passAdmin} onChange={e => setPassAdmin(e.target.value)} placeholder={`Admin: ${gameState.passwords.admin}`} className="w-full p-2 bg-gray-900 border-4 border-gray-700 rounded-xl font-bold text-white outline-none focus:border-white" />
                      <input type="text" value={passOrange} onChange={e => setPassOrange(e.target.value)} placeholder={`Orange: ${gameState.passwords.orange}`} className="w-full p-2 bg-gray-900 border-4 border-gray-700 rounded-xl font-bold text-white outline-none focus:border-white" />
                      <input type="text" value={passBlue} onChange={e => setPassBlue(e.target.value)} placeholder={`Blau: ${gameState.passwords.blue}`} className="w-full p-2 bg-gray-900 border-4 border-gray-700 rounded-xl font-bold text-white outline-none focus:border-white" />
                      <button type="submit" className={`${btnBase} w-full py-3 bg-[#6366f1] border-transparent text-white hover:bg-[#4f46e5]`}>PASSWÖRTER SPEICHERN</button>
                    </form>

                    <div className="space-y-4 pt-5 border-t-4 border-gray-700">
                      <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Deck Inspektor</h3>
                      <div>
                        <h4 className="text-xs font-black uppercase mb-2 text-gray-500">Im Stapel ({gameState.deck.length})</h4>
                        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto bg-gray-900 p-3 rounded-xl border-4 border-gray-700 custom-scrollbar">
                          {gameState.deck.length === 0 && <span className="font-bold text-gray-600 text-sm">Stapel leer.</span>}
                          {gameState.deck.map((c, i) => (
                            <span key={i} className="bg-gray-800 text-white font-bold text-xs px-2 py-1 rounded-lg border-2 border-gray-600 flex items-center space-x-1">
                              <span>{c}</span>
                              <button onClick={() => handleDeleteFromDeck(c)} className="hover:text-red-400 transition-colors ml-1"><X size={14} strokeWidth={3}/></button>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="text-xs font-black uppercase text-red-400">Gelöscht ({(gameState.deletedCards || []).length})</h4>
                          {(gameState.deletedCards || []).length > 0 && (
                            <button onClick={handleRestoreAllDeletedToDeck} className="text-[10px] bg-red-600 text-white px-2 py-1 rounded font-black uppercase tracking-wider hover:bg-red-500 transition-colors flex items-center space-x-1">
                              <RotateCcw size={12} strokeWidth={3}/> <span>ALLE RETTEN</span>
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto bg-gray-900 p-3 rounded-xl border-4 border-gray-700 custom-scrollbar">
                          {(gameState.deletedCards || []).length === 0 && <span className="font-bold text-gray-600 text-sm">Keine gelöscht.</span>}
                          {(gameState.deletedCards || []).map((c, i) => (
                            <span key={`del-${i}`} className="bg-red-900/50 text-red-300 font-bold text-xs px-2 py-1 rounded-lg border-2 border-red-800 flex items-center space-x-1">
                              <span>{c}</span>
                              <button onClick={() => handleRestoreDeletedToDeck(c)} className="hover:text-white transition-colors ml-1"><RotateCcw size={14} strokeWidth={3}/></button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}