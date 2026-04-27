/**
 * CS Digital Setup — Chat Client
 * Logique complète du chatbot : session, streaming SSE, UI
 */

// ============================================
// Configuration
// ============================================
const SUPABASE_FUNCTIONS_URL =
  "https://ptksijwyvecufcvcpntp.supabase.co/functions/v1";

// ============================================
// Compression de l'historique
// ============================================
function compressMessages(messages, keepLast = 5) {
  if (!messages || messages.length === 0) return [];
  if (messages.length <= keepLast + 10) return messages;

  const keepFull = messages.slice(-keepLast);
  const toCompress = messages.slice(0, messages.length - keepLast);
  const compressed = [];

  // Résumer par blocs de 10
  for (let i = 0; i < toCompress.length; i += 10) {
    const chunk = toCompress.slice(i, Math.min(i + 10, toCompress.length));
    const keyPoints = [];

    for (const msg of chunk) {
      if (msg.role === "user") {
        const firstLine = msg.split("\n")[0].trim();
        if (firstLine.length > 0) {
          const truncated = firstLine.length > 60 ? firstLine.slice(0, 60) + "..." : firstLine;
          keyPoints.push(`Q: ${truncated}`);
        }
      }
    }

    if (keyPoints.length > 0) {
      compressed.push({
        role: "system",
        content: `[DIAGNOSTIC_HISTORY] Messages ${i + 1}-${Math.min(i + 10, toCompress.length)}: ${keyPoints.join(" | ")}`,
      });
    }
  }

  return [...compressed, ...keepFull];
}

// ============================================
// État
// ============================================
let jwtToken = null;
let userEmail = null;
let sessionId = null;
let sessionData = null;
let isStreaming = false;
let conversationHistory = [];

// ============================================
// Generate unique session ID for this diagnostic
// ============================================
function generateSessionId() {
  return "session_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
}

// ============================================
// Éléments DOM
// ============================================
const loadingScreen = document.getElementById("loading-screen");
const errorScreen = document.getElementById("error-screen");
const chatScreen = document.getElementById("chat-screen");
const messagesContainer = document.getElementById("messages-container");
const typingIndicator = document.getElementById("typing-indicator");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");

// ============================================
// Initialisation
// ============================================
async function init() {
  // Extract JWT from localStorage (set by auth/callback.html)
  jwtToken = localStorage.getItem("jwt_token");
  userEmail = localStorage.getItem("user_email");

  if (!jwtToken || !userEmail) {
    console.log("No JWT found, redirecting to home");
    showError();
    return;
  }

  // Generate a unique session ID for this diagnostic session
  sessionId = generateSessionId();

  try {
    // Show chat screen
    showChat();

    // First visit: send welcome message to start diagnostic
    await sendFirstMessage();
  } catch (err) {
    console.error("Init error:", err);
    showError();
  }
}

// ============================================
// Affichage des écrans
// ============================================
function showError() {
  loadingScreen.style.display = "none";
  errorScreen.style.display = "flex";
  chatScreen.style.display = "none";
}

function showDeviceError() {
  loadingScreen.style.display = "none";
  chatScreen.style.display = "none";
  errorScreen.style.display = "flex";
  const errorTitle = errorScreen.querySelector("h2");
  const errorText = errorScreen.querySelector("p");
  if (errorTitle) errorTitle.textContent = "Lien personnel";
  if (errorText) errorText.textContent = "Ce lien est associé à un autre appareil. Chaque configuration est personnelle et liée à l'appareil utilisé lors du premier accès. Contactez catherine@csbusiness.fr si vous avez besoin d'aide.";
}

function showChat() {
  loadingScreen.style.display = "none";
  errorScreen.style.display = "none";
  chatScreen.style.display = "flex";
  chatInput.focus();
}

// ============================================
// Messages
// ============================================
function appendMessage(role, content) {
  const div = document.createElement("div");
  div.className = `message message-${role}`;

  // Nettoyer les blocs META et le marqueur DIAGNOSTIC_COMPLETE
  let cleanContent = content
    .replace(/\[META\][\s\S]*?\[\/META\]/g, "")
    .replace(/\[DIAGNOSTIC_COMPLETE\]/g, "")
    .trim();

  // Convertir le markdown basique en HTML
  div.innerHTML = markdownToHtml(cleanContent);

  // Insérer avant le typing indicator
  messagesContainer.insertBefore(div, typingIndicator);

  // Vérifier si le diagnostic est complet
  if (content.includes("[DIAGNOSTIC_COMPLETE]")) {
    showDiagnosticComplete();
  }

  return div;
}

function createStreamingBubble() {
  const div = document.createElement("div");
  div.className = "message message-assistant";
  div.id = "streaming-bubble";
  messagesContainer.insertBefore(div, typingIndicator);
  return div;
}

function showDiagnosticComplete() {
  // Désactiver la saisie
  chatInput.disabled = true;
  sendBtn.disabled = true;
  chatInput.placeholder = "Diagnostic terminé";

  // Lancer la génération de la config
  generateConfig(sessionToken);
}

// ============================================
// Markdown basique → HTML
// ============================================
function markdownToHtml(text) {
  return text
    // Titres
    .replace(/^### (.+)$/gm, "<strong>$1</strong>")
    .replace(/^## (.+)$/gm, "<strong>$1</strong>")
    // Gras
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italique
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Listes à puces
    .replace(/^- (.+)$/gm, "• $1")
    // Sauts de ligne → paragraphes
    .split("\n\n")
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// ============================================
// Premier message (bienvenue)
// ============================================
async function sendFirstMessage() {
  isStreaming = true;
  sendBtn.disabled = true;
  chatInput.disabled = true;

  // Afficher le typing indicator
  typingIndicator.classList.add("visible");
  scrollToBottom();

  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtToken}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        message: "Bonjour",
        conversation_history: conversationHistory,
        client_name: userEmail,
      }),
    });

    if (res.status === 401) {
      throw new Error("Session expirée. Veuillez vous reconnecter.");
    }
    if (res.status === 403) {
      throw new Error("Accès refusé. Veuillez vérifier votre paiement.");
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    typingIndicator.classList.remove("visible");
    const bubble = createStreamingBubble();
    let fullText = "";

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        try {
          const data = JSON.parse(jsonStr);
          if (data.done) break;
          if (data.text) {
            fullText += data.text;
            const cleanText = fullText
              .replace(/\[META\][\s\S]*?\[\/META\]/g, "")
              .replace(/\[DIAGNOSTIC_COMPLETE\]/g, "")
              .trim();
            bubble.innerHTML = markdownToHtml(cleanText);
            scrollToBottom();
          }
        } catch {}
      }
    }

    const cleanFinal = fullText
      .replace(/\[META\][\s\S]*?\[\/META\]/g, "")
      .replace(/\[DIAGNOSTIC_COMPLETE\]/g, "")
      .trim();
    bubble.innerHTML = markdownToHtml(cleanFinal);
    bubble.removeAttribute("id");

    // Store in conversation history
    conversationHistory.push({ role: "user", content: "Bonjour" });
    conversationHistory.push({ role: "assistant", content: cleanFinal });
  } catch (err) {
    console.error("First message error:", err);
    typingIndicator.classList.remove("visible");
    appendMessage("assistant", `Erreur: ${err.message}`);
  } finally {
    isStreaming = false;
    sendBtn.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
    scrollToBottom();
  }
}

// ============================================
// Envoi et streaming
// ============================================
async function sendMessage(text) {
  if (isStreaming) return;
  if (!text.trim()) return;

  isStreaming = true;
  sendBtn.disabled = true;
  chatInput.disabled = true;

  // Afficher le message utilisateur
  appendMessage("user", text);
  scrollToBottom();

  // Afficher le typing indicator
  typingIndicator.classList.add("visible");
  scrollToBottom();

  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtToken}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        message: text,
        conversation_history: conversationHistory,
        client_name: userEmail,
      }),
    });

    if (res.status === 401) {
      throw new Error("Session expirée. Veuillez vous reconnecter.");
    }
    if (res.status === 403) {
      throw new Error("Accès refusé. Veuillez vérifier votre paiement.");
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    // Masquer le typing, créer la bulle de streaming
    typingIndicator.classList.remove("visible");
    const bubble = createStreamingBubble();
    let fullText = "";

    // Lire le stream SSE
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parser les événements SSE
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const data = JSON.parse(jsonStr);

          if (data.done) {
            // Stream terminé
            break;
          }

          if (data.error) {
            fullText += "\n\n⚠️ Une erreur est survenue. Veuillez réessayer.";
            break;
          }

          if (data.text) {
            fullText += data.text;

            // Mettre à jour la bulle en temps réel (sans les META)
            const cleanText = fullText
              .replace(/\[META\][\s\S]*?\[\/META\]/g, "")
              .replace(/\[DIAGNOSTIC_COMPLETE\]/g, "")
              .trim();
            bubble.innerHTML = markdownToHtml(cleanText);
            scrollToBottom();
          }
        } catch {
          // JSON invalide, ignorer
        }
      }
    }

    // Finaliser la bulle
    const cleanFinal = fullText
      .replace(/\[META\][\s\S]*?\[\/META\]/g, "")
      .replace(/\[DIAGNOSTIC_COMPLETE\]/g, "")
      .trim();
    bubble.innerHTML = markdownToHtml(cleanFinal);
    bubble.removeAttribute("id");

    // Store in conversation history
    conversationHistory.push({ role: "user", content: text });
    conversationHistory.push({ role: "assistant", content: cleanFinal });

    // Vérifier si diagnostic complet
    if (fullText.includes("[DIAGNOSTIC_COMPLETE]")) {
      showDiagnosticComplete();
    }
  } catch (err) {
    console.error("Stream error:", err);
    typingIndicator.classList.remove("visible");
    appendMessage("assistant", `Erreur: ${err.message}`);
  } finally {
    isStreaming = false;
    sendBtn.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
    scrollToBottom();
  }
}

// ============================================
// Scroll
// ============================================
function scrollToBottom() {
  requestAnimationFrame(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

// ============================================
// Auto-resize du textarea
// ============================================
function autoResize() {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
}

// ============================================
// Dictée vocale (Web Speech API)
// ============================================
const micBtn = document.getElementById("mic-btn");
let recognition = null;
let isRecording = false;

function initSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn("Speech API not supported");
    micBtn.classList.add("unsupported");
    return;
  }

  console.log("Speech API available");
}

function startRecording() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) return;

  // Créer une nouvelle instance à chaque fois (plus fiable)
  recognition = new SpeechRecognition();
  recognition.lang = "fr-FR";
  recognition.continuous = true;
  recognition.interimResults = true;

  let finalTranscript = "";
  const startValue = chatInput.value;

  recognition.onstart = () => {
    console.log("Recording started");
    isRecording = true;
    micBtn.classList.add("recording");
    chatInput.placeholder = "Parlez, je vous écoute...";
  };

  recognition.onresult = (event) => {
    let interim = "";
    finalTranscript = "";
    for (let i = 0; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interim += transcript;
      }
    }
    chatInput.value = startValue + (startValue ? " " : "") + finalTranscript + interim;
    autoResize();
  };

  recognition.onerror = (event) => {
    console.error("Speech error:", event.error);
    if (event.error === "not-allowed") {
      alert("Veuillez autoriser l'accès au micro dans votre navigateur.");
    }
    stopRecording();
  };

  recognition.onend = () => {
    console.log("Recording ended");
    // Si on est encore en mode recording, c'est un arrêt automatique — relancer
    if (isRecording) {
      // Chrome arrête parfois après un silence, on ne relance pas
      stopRecording();
    }
  };

  try {
    recognition.start();
  } catch (err) {
    console.error("Start recording error:", err);
  }
}

function stopRecording() {
  isRecording = false;
  micBtn.classList.remove("recording");
  chatInput.placeholder = "Tapez ou dictez votre réponse...";
  if (recognition) {
    try {
      recognition.stop();
    } catch {}
    recognition = null;
  }
  chatInput.focus();
}

function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

initSpeechRecognition();

// ============================================
// Event listeners
// ============================================
sendBtn.addEventListener("click", () => {
  if (isRecording) stopRecording();
  const text = chatInput.value.trim();
  if (text) {
    chatInput.value = "";
    chatInput.style.height = "auto";
    sendMessage(text);
  }
});

micBtn.addEventListener("click", toggleRecording);

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

chatInput.addEventListener("input", autoResize);

// Gérer le clavier virtuel sur mobile
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    document.documentElement.style.setProperty(
      "--vh",
      `${window.visualViewport.height * 0.01}px`
    );
    scrollToBottom();
  });
}

// ============================================
// Lancement
// ============================================
init();
