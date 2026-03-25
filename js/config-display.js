/**
 * CS Digital Setup — Config Display
 * Affichage des livrables générés + boutons copier + checklist d'import
 */

const SUPABASE_FUNCTIONS_URL_CONFIG =
  "https://ptksijwyvecufcvcpntp.supabase.co/functions/v1";

// ============================================
// Génération de la config
// ============================================
async function generateConfig(token) {
  console.log("generateConfig called with token:", token);
  const container = document.getElementById("messages-container");

  // Ajouter un indicateur de génération
  const genDiv = document.createElement("div");
  genDiv.className = "diagnostic-complete";
  genDiv.id = "generation-indicator";
  genDiv.innerHTML =
    '<div class="spinner" style="margin:0 auto var(--space-sm)"></div><strong>Génération en cours...</strong><br>Votre configuration personnalisée est en cours de création. Cela peut prendre jusqu\'à 60 secondes...';
  container.appendChild(genDiv);
  container.scrollTop = container.scrollHeight;

  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL_CONFIG}/generate-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erreur de génération");
    }

    const config = await res.json();

    // Retirer l'indicateur
    document.getElementById("generation-indicator")?.remove();

    // Afficher les résultats
    displayConfig(config);
  } catch (err) {
    console.error("Generation error:", err);
    const indicator = document.getElementById("generation-indicator");
    if (indicator) {
      indicator.innerHTML =
        "<strong>Erreur de génération</strong><br>Veuillez rafraîchir la page et réessayer.";
    }
  }
}

// ============================================
// Affichage de la config
// ============================================
function displayConfig(config) {
  const container = document.getElementById("messages-container");

  // Masquer la zone de saisie
  document.querySelector(".chat-input-area").style.display = "none";

  // Créer le conteneur de résultats
  const resultsDiv = document.createElement("div");
  resultsDiv.className = "config-results";
  resultsDiv.innerHTML = `
    <div class="config-header">
      <h2>Votre configuration Claude.ai est prête${config.client_name ? ", " + config.client_name : ""} !</h2>
      <p>Suivez les étapes ci-dessous pour tout importer dans Claude.ai</p>
    </div>
  `;

  // Bannière Niveau 1
  const level1 = document.createElement("div");
  level1.className = "config-level-banner";
  level1.innerHTML = `<h3>Niveau 1 — Version gratuite</h3><p>Ces éléments fonctionnent avec toutes les versions de Claude.ai</p>`;
  resultsDiv.appendChild(level1);

  // 1. Custom Instructions
  if (config.custom_instructions) {
    resultsDiv.appendChild(
      createConfigSection(
        "1",
        "Instructions personnalisées",
        "Allez dans Claude.ai → Cliquez sur votre nom en bas à gauche → Paramètres → Instructions personnalisées → Collez le texte ci-dessous",
        config.custom_instructions,
        "C'est le socle de votre Claude : il saura qui vous êtes et comment vous aider."
      )
    );
  }

  // 2. Bouclier de sécurité
  if (config.security_shield) {
    resultsDiv.appendChild(
      createConfigSection(
        "2",
        "Vos règles de sécurité IA",
        "Ces règles sont intégrées dans vos instructions personnalisées. Voici le récapitulatif des protections configurées :",
        config.security_shield.summary_text || config.security_shield.certificate_text || config.security_shield.rules?.join("\n• ") || "",
        "Ce récapitulatif liste les protections actives dans votre configuration. Ce n'est pas un certificat officiel, mais vos règles de sécurité sont bien en place."
      )
    );
  }

  // 8. Style personnalisé (aussi dispo en gratuit)
  if (config.custom_style) {
    resultsDiv.appendChild(
      createConfigSection(
        "3",
        `Style : ${config.custom_style.name || "Mon Style"}`,
        "Allez dans Claude.ai → Paramètres → Styles → Créer un style personnalisé → Collez la description ci-dessous",
        config.custom_style.description,
        config.custom_style.why
      )
    );
  }

  // Bannière Niveau 2
  const level2 = document.createElement("div");
  level2.className = "config-level-banner level-pro";
  level2.innerHTML = `<h3>Niveau 2 — Version Pro</h3><p>Pour aller plus loin, passez à Claude Pro. Vous débloquez les projets, les agents, les tâches automatiques et le co-travail.</p>`;
  resultsDiv.appendChild(level2);

  // 3. Projets
  if (config.projects && config.projects.length > 0) {
    let stepNum = 3;
    for (const project of config.projects) {
      resultsDiv.appendChild(
        createConfigSection(
          String(stepNum),
          `Projet : ${project.name}`,
          `Allez dans Claude.ai → Projets → Nouveau projet → Nom : "${project.name}" → Collez les instructions ci-dessous`,
          project.system_prompt,
          project.why
        )
      );
      stepNum++;
    }
  }

  // 4. Agents
  if (config.agents && config.agents.length > 0) {
    for (const agent of config.agents) {
      resultsDiv.appendChild(
        createConfigSection(
          "★",
          `Agent : ${agent.name}`,
          agent.creation_guide || `Créez un agent "${agent.name}" dans Claude.ai avec les instructions ci-dessous`,
          agent.instructions,
          agent.why,
          agent.tools ? `Outils recommandés : ${agent.tools.join(", ")}` : null
        )
      );
    }
  }

  // 5. Agent Coach
  if (config.agent_coach) {
    resultsDiv.appendChild(
      createConfigSection(
        "★",
        `Projet : ${config.agent_coach.name || "Mon Coach Digital"}`,
        "Créez un nouveau projet avec ce nom et collez les instructions ci-dessous",
        config.agent_coach.instructions,
        config.agent_coach.why,
        config.agent_coach.weekly_prompt
          ? `💡 Prompt hebdomadaire suggéré : "${config.agent_coach.weekly_prompt}"`
          : null
      )
    );
  }

  // 6. Agent Miroir
  if (config.agent_miroir) {
    resultsDiv.appendChild(
      createConfigSection(
        "★",
        `Projet : ${config.agent_miroir.name || "Mon Miroir"}`,
        "Créez un nouveau projet avec ce nom et collez les instructions ci-dessous",
        config.agent_miroir.instructions,
        config.agent_miroir.why,
        config.agent_miroir.rituals
          ? `Rituels suggérés : ${config.agent_miroir.rituals.join(" | ")}`
          : null
      )
    );
  }

  // 7. Tâches programmées
  if (config.scheduled_tasks && config.scheduled_tasks.length > 0) {
    for (const task of config.scheduled_tasks) {
      const taskContent = `${task.description}\n\nFréquence : ${task.frequency}${task.best_time ? "\nMoment idéal : " + task.best_time : ""}${task.target_agent ? "\nAppelle automatiquement : " + task.target_agent : ""}\n\nCe que Claude enverra automatiquement :\n« ${task.prompt_suggestion || "..."} »${task.creation_guide ? "\n\n--- Comment configurer cette tâche ---\n" + task.creation_guide : ""}`;
      resultsDiv.appendChild(
        createConfigSection(
          "⏰",
          `Tâche auto : ${task.name}`,
          "Configurez-la une fois, ensuite elle tourne toute seule",
          taskContent,
          task.why
        )
      );
    }
  }

  // Niveau 3 — Expert (MCP)
  if (config.mcp_connections && config.mcp_connections.length > 0) {
    const level3 = document.createElement("div");
    level3.className = "config-level-banner level-expert";
    level3.innerHTML = `<h3>Niveau 3 — Expert</h3><p>Connectez Claude directement à vos outils pour qu'il puisse lire, écrire et agir dedans. Nécessite Claude Desktop ou Claude Pro avec MCP.</p>`;
    resultsDiv.appendChild(level3);

    for (const mcp of config.mcp_connections) {
      resultsDiv.appendChild(
        createConfigSection(
          "🔌",
          `Connexion : ${mcp.name}`,
          `Connecte Claude à ${mcp.tool_used_by_client || mcp.name}`,
          mcp.setup_guide || "",
          mcp.why,
          mcp.what_it_does ? `Ce que ça permet : ${mcp.what_it_does}` : null
        )
      );
    }
  }

  // Bouton envoyer par email
  resultsDiv.appendChild(createEmailSection());

  // Questionnaire beta (si session beta)
  resultsDiv.appendChild(createFeedbackSection());

  // CTA upsell
  resultsDiv.appendChild(createUpsellSection());

  container.appendChild(resultsDiv);
  container.scrollTop = container.scrollHeight;
}

// ============================================
// Créer une section de config
// ============================================
function createConfigSection(step, title, instruction, content, why, extra) {
  const section = document.createElement("div");
  section.className = "config-section";

  const checkId = `check-${step}-${title.replace(/\s/g, "")}`;

  section.innerHTML = `
    <div class="config-section-header">
      <div class="config-step">${step}</div>
      <div class="config-section-title">
        <h3>${title}</h3>
        <p class="config-instruction">${instruction}</p>
      </div>
      <label class="config-check" for="${checkId}">
        <input type="checkbox" id="${checkId}" onchange="saveChecklist()">
        <span class="config-check-mark">✓</span>
      </label>
    </div>
    ${why ? `<p class="config-why">${why}</p>` : ""}
    ${extra ? `<p class="config-extra">${extra}</p>` : ""}
    <div class="config-content-wrapper">
      <div class="config-content">${escapeHtml(content)}</div>
      <button class="config-copy-btn" onclick="copyContent(this)">
        Copier
      </button>
    </div>
  `;

  return section;
}

// ============================================
// Section email
// ============================================
function createEmailSection() {
  const section = document.createElement("div");
  section.className = "config-email-section";
  section.innerHTML = `
    <p>Recevez toute votre configuration par email pour l'avoir sous la main :</p>
    <button id="send-email-btn" class="config-email-btn" onclick="sendConfigEmail()">
      Recevoir par email
    </button>
    <p id="email-status" class="config-email-status"></p>
  `;
  return section;
}

async function sendConfigEmail() {
  const btn = document.getElementById("send-email-btn");
  const status = document.getElementById("email-status");
  btn.disabled = true;
  btn.textContent = "Envoi en cours...";

  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL_CONFIG}/send-config-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: sessionToken }),
    });

    const data = await res.json();

    if (res.ok) {
      btn.textContent = "Email envoyé !";
      btn.classList.add("sent");
      status.textContent = `Envoyé à ${data.email}`;
      status.style.color = "var(--success)";
    } else {
      btn.textContent = "Recevoir par email";
      btn.disabled = false;
      status.textContent = data.error || "Erreur lors de l'envoi";
      status.style.color = "var(--danger)";
    }
  } catch (err) {
    btn.textContent = "Recevoir par email";
    btn.disabled = false;
    status.textContent = "Erreur de connexion";
    status.style.color = "var(--danger)";
  }
}

// ============================================
// Section feedback beta
// ============================================
function createFeedbackSection() {
  const section = document.createElement("div");
  section.className = "config-feedback";
  section.id = "feedback-section";
  section.innerHTML = `
    <h3>Votre avis compte !</h3>
    <p>Cet outil est en version beta. Vos retours nous aident à l'améliorer. 6 questions, 2 minutes max.</p>

    <div class="feedback-question">
      <label>Note globale de l'expérience :</label>
      <div class="feedback-stars" id="feedback-rating">
        <button onclick="setRating(1)" data-star="1">★</button>
        <button onclick="setRating(2)" data-star="2">★</button>
        <button onclick="setRating(3)" data-star="3">★</button>
        <button onclick="setRating(4)" data-star="4">★</button>
        <button onclick="setRating(5)" data-star="5">★</button>
      </div>
    </div>

    <div class="feedback-question">
      <label>La configuration générée vous semble utile ?</label>
      <div class="feedback-yesno">
        <button onclick="setFeedback('useful', true, this)" class="fb-btn">Oui</button>
        <button onclick="setFeedback('useful', false, this)" class="fb-btn">Pas vraiment</button>
      </div>
    </div>

    <div class="feedback-question">
      <label>L'outil était facile à utiliser ?</label>
      <div class="feedback-yesno">
        <button onclick="setFeedback('easy_to_use', true, this)" class="fb-btn">Oui</button>
        <button onclick="setFeedback('easy_to_use', false, this)" class="fb-btn">Pas vraiment</button>
      </div>
    </div>

    <div class="feedback-question">
      <label>Vous le recommanderiez à un(e) collègue ?</label>
      <div class="feedback-yesno">
        <button onclick="setFeedback('would_recommend', true, this)" class="fb-btn">Oui</button>
        <button onclick="setFeedback('would_recommend', false, this)" class="fb-btn">Pas vraiment</button>
      </div>
    </div>

    <div class="feedback-question">
      <label>Ce que vous avez le plus apprécié :</label>
      <textarea id="feedback-best" class="feedback-text" placeholder="En quelques mots..." rows="2"></textarea>
    </div>

    <div class="feedback-question">
      <label>Combien seriez-vous prêt(e) à payer pour cet outil ?</label>
      <div class="feedback-yesno feedback-price">
        <button onclick="setPrice('0-30', this)" class="fb-btn">Moins de 30 €</button>
        <button onclick="setPrice('30-60', this)" class="fb-btn">30 à 60 €</button>
        <button onclick="setPrice('60-100', this)" class="fb-btn">60 à 100 €</button>
        <button onclick="setPrice('100+', this)" class="fb-btn">Plus de 100 €</button>
      </div>
    </div>

    <div class="feedback-question">
      <label>Ce qu'on pourrait améliorer :</label>
      <textarea id="feedback-improve" class="feedback-text" placeholder="En quelques mots..." rows="2"></textarea>
    </div>

    <button id="feedback-submit-btn" class="feedback-submit" onclick="submitFeedback()">Envoyer mes retours</button>
    <p id="feedback-status" class="feedback-status"></p>
  `;
  return section;
}

let feedbackData = { rating: 0, useful: null, easy_to_use: null, would_recommend: null, price_willing: null };

function setRating(n) {
  feedbackData.rating = n;
  document.querySelectorAll("#feedback-rating button").forEach((btn) => {
    btn.classList.toggle("active", parseInt(btn.dataset.star) <= n);
  });
}

function setFeedback(key, value, btn) {
  feedbackData[key] = value;
  btn.parentElement.querySelectorAll(".fb-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
}

function setPrice(value, btn) {
  feedbackData.price_willing = value;
  btn.parentElement.querySelectorAll(".fb-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
}

async function submitFeedback() {
  const btn = document.getElementById("feedback-submit-btn");
  const status = document.getElementById("feedback-status");

  feedbackData.best_part = document.getElementById("feedback-best")?.value || "";
  feedbackData.to_improve = document.getElementById("feedback-improve")?.value || "";

  if (!feedbackData.rating) {
    status.textContent = "Merci de donner une note (les étoiles)";
    status.style.color = "var(--warning)";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Envoi...";

  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL_CONFIG}/submit-feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: sessionToken, ...feedbackData }),
    });

    if (res.ok) {
      btn.textContent = "Merci !";
      btn.classList.add("sent");
      status.textContent = "Vos retours ont été envoyés. Merci beaucoup !";
      status.style.color = "var(--success)";
    } else {
      btn.textContent = "Envoyer mes retours";
      btn.disabled = false;
      status.textContent = "Erreur, veuillez réessayer";
      status.style.color = "var(--danger)";
    }
  } catch {
    btn.textContent = "Envoyer mes retours";
    btn.disabled = false;
    status.textContent = "Erreur de connexion";
    status.style.color = "var(--danger)";
  }
}

// ============================================
// Section upsell
// ============================================
function createUpsellSection() {
  const section = document.createElement("div");
  section.className = "config-upsell";
  section.innerHTML = `
    <h3>Envie d'aller plus loin ?</h3>
    <p>CS Consulting Stratégique accompagne les dirigeants de TPE dans leur transformation digitale complète : stratégie, process, automatisations, et bien plus.</p>
    <a href="https://fantastical.app/consulting-strategique/mon-modele-copie" target="_blank" class="config-upsell-btn">
      Prendre rendez-vous (30 min gratuites)
    </a>
  `;
  return section;
}

// ============================================
// Copier dans le presse-papier
// ============================================
async function copyContent(btn) {
  const content = btn.previousElementSibling.textContent;
  try {
    await navigator.clipboard.writeText(content);
    btn.textContent = "Copié !";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = "Copier";
      btn.classList.remove("copied");
    }, 2000);
  } catch {
    // Fallback pour les navigateurs sans clipboard API
    const textarea = document.createElement("textarea");
    textarea.value = content;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    btn.textContent = "Copié !";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = "Copier";
      btn.classList.remove("copied");
    }, 2000);
  }
}

// ============================================
// Sauvegarder la checklist dans localStorage
// ============================================
function saveChecklist() {
  const checks = document.querySelectorAll('.config-check input[type="checkbox"]');
  const state = {};
  checks.forEach((cb) => {
    state[cb.id] = cb.checked;
  });
  localStorage.setItem(`checklist_${sessionToken}`, JSON.stringify(state));
}

function restoreChecklist() {
  const saved = localStorage.getItem(`checklist_${sessionToken}`);
  if (!saved) return;
  try {
    const state = JSON.parse(saved);
    for (const [id, checked] of Object.entries(state)) {
      const cb = document.getElementById(id);
      if (cb) cb.checked = checked;
    }
  } catch {}
}

// ============================================
// Utilitaires
// ============================================
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
