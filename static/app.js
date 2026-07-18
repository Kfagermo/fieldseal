const THEME_STORAGE_KEY = "fieldseal-theme-v1";

function preferredTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme = preferredTheme(), persist = false) {
  const normalized = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = normalized;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", normalized === "dark" ? "#08090a" : "#f7f8f8");
  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.setAttribute("aria-label", `Switch to ${normalized === "dark" ? "light" : "dark"} theme`);
    toggle.title = `Switch to ${normalized === "dark" ? "light" : "dark"} theme`;
    const label = toggle.querySelector("strong");
    if (label) label.textContent = normalized === "dark" ? "Dark" : "Light";
  }
  if (persist) localStorage.setItem(THEME_STORAGE_KEY, normalized);
}

applyTheme();

const state = {
  user: null,
  memberships: [],
  assignments: [],
  document_packages: [],
  demo_documentation: null,
  policy: null,
  csrf: "",
  activeOrgId: localStorage.getItem("esense-active-org-v1") || "",
  members: [],
  customers: [],
  current: null,
  assignmentFilter: "all",
  lastListView: "overview",
  saveTimer: null,
  completionSaveTimer: null,
  assignmentStep: 1,
  assignmentMaxStep: 1,
  selectedMemberId: "",
  settingsTab: "profile",
  inviteLinkId: "",
};

const byId = (id) => document.getElementById(id);
const tr = (value) => window.esenseI18n?.t(value) || value;
const activeLocale = () => window.esenseI18n?.locale() || "nb-NO";
const isEnglish = () => window.esenseI18n?.language() === "en";

function midnightMark() {
  const tooltip = tr("Midnight-grense: bare dokumentforpliktelsen kan forankres. Rapportinnhold og personopplysninger forblir private, og ingen transaksjon hevdes før den er bekreftet.");
  return `<span class="midnight-mark" tabindex="0" aria-label="${escapeHtml(tooltip)}" data-tooltip="${escapeHtml(tooltip)}"><img src="/static/midnight-logo-dark.svg" alt="Midnight" /></span>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function formatDate(value) {
  if (!value) return tr("Ikke satt");
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(activeLocale(), { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value) {
  if (!value) return tr("Ikke registrert");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(activeLocale(), {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function evidencePhaseLabel(value) {
  return tr(({ before: "Før arbeidet", during: "Under utførelsen", after: "Etter arbeidet" })[value] || "Dokumentasjon");
}

function evidenceTypeLabel(value) {
  return tr(({
    photo: "Bilde", measurement: "Måleresultat", checklist: "Sjekkliste",
    declaration: "Erklæring eller skjema", product_data: "Produktdata / FDV",
    drawing: "Tegning", other: "Annet",
  })[value] || "Dokumentasjon");
}

function statusLabel(value) {
  return tr(({
    published: "Publisert",
    accepted: "Akseptert",
    declined: "Avslått",
    in_planning: "Under planlegging",
    submitted: "Innsendt",
    returned: "Returnert",
    accepted_plan: "Plan godkjent",
    in_execution: "Under utførelse",
    completion_submitted: "Sluttkontroll innsendt",
    completion_returned: "Sluttkontroll returnert",
    completed: "Utførelse godkjent",
    cancelled: "Kansellert",
    closed: "Avsluttet",
  })[value] || "Ukjent status");
}

function contextLabel(value) {
  return tr(({ training_synthetic: "Øvelse - syntetisk", supervised_practice: "Veiledet praksis", professional_work: "Profesjonelt arbeid" })[value] || "Ukjent kontekst");
}

function roleLabel(value) {
  return tr(({ admin: "Leder", task_provider: "Oppdragsgiver", worker: "Tekniker", reviewer: "Kontrollør", member: "Medlem", assigned_worker: "Tildelt arbeidstaker", professional_responsible: "Faglig ansvarlig" })[value] || "Ukjent rolle");
}

function shortRoleLabel(value) {
  return tr(({ admin: "Leder", task_provider: "Oppdrag", worker: "Tekniker", reviewer: "Kontroll", member: "Medlem", assigned_worker: "Utfører", professional_responsible: "AFA" })[value] || "Medlem");
}

function renderActiveRoles(roles = [], fallback = "Medlem") {
  const element = byId("activeRole");
  const settingsElement = byId("settingsActiveRole");
  const managerView = roles.includes("admin") || roles.includes("task_provider");
  const reviewerView = !managerView && roles.includes("reviewer");
  const workspace = managerView ? "Oppdrag" : reviewerView ? "Kontroll" : roles.includes("worker") ? "Jobber" : "Oppdrag";
  byId("assignmentsNavLabel").textContent = tr(workspace);
  byId("assignmentsTitle").textContent = tr(workspace);
  byId("sidebarJobsTitle").textContent = tr(managerView ? "Oppdrag" : reviewerView ? "Til vurdering" : "Mine jobber");
  byId("workspaceMode").textContent = tr(workspace);
  if (!roles.length) {
    element.textContent = tr(fallback);
    settingsElement.textContent = tr(fallback);
    return;
  }
  const fullLabel = roles.map(roleLabel).join(" · ");
  element.innerHTML = `<span class="active-role-chips" aria-label="${escapeHtml(fullLabel)}">${roles.map((role) => `<span class="active-role-chip" title="${escapeHtml(roleLabel(role))}">${escapeHtml(shortRoleLabel(role))}</span>`).join("")}</span>`;
  settingsElement.innerHTML = element.innerHTML;
}

function organizationTypeLabel(value) {
  return tr(({ school: "Skole", enterprise: "Virksomhet", other: "Annet" })[value] || "Annet");
}

function primaryFamilyLabel(value) {
  return tr(({ electro: "Elektro", ekom: "Ekom", both: "Elektro og ekom" })[value] || "Ikke oppgitt");
}

function sourceClassLabel(value) {
  return tr(({ regulation: "Forskrift", law: "Lov", official_guidance: "Offentlig veiledning", standard: "Standard", manufacturer_instruction: "Produsentinstruks", organization_procedure: "Virksomhetsprosedyre", planning_rule: "Planleggingsregel" })[value] || "Annen kilde");
}

function policyStatusLabel(value) {
  return tr(({ draft_review_required: "Utkast - krever faglig gjennomgang", reviewed: "Faglig gjennomgått", retired: "Utgått" })[value] || "Ukjent status");
}

function planningFieldLabel(value) {
  return tr(({ work_description: "arbeidsomfang", work_method: "arbeidsmetode", risk_controls: "risikotiltak", tests_and_evidence: "prøving og dokumentasjon", open_questions: "åpne spørsmål" })[value] || "påkrevd felt");
}

function completionFieldLabel(value) {
  return tr(({
    work_performed: "utført arbeid",
    safe_closure: "sikker avslutning",
    tests_and_results: "prøving og kontrollresultater",
    deviations: "avvik eller gjenstående arbeid",
    evidence_references: "dokumentasjon og vedlegg",
  })[value] || "påkrevd felt");
}

function packageStatusLabel(value) {
  return tr(({ issued: "Utstedt", superseded: "Erstattet", revoked: "Tilbakekalt" })[value] || "Ukjent status");
}

function grantTypeLabel(value) {
  return tr(({ owner: "Eier", contractor: "Utførende virksomhet", authority: "Myndighet eller tilsyn" })[value] || "Mottaker");
}

function midnightStatusLabel(value) {
  return tr(({
    not_submitted: "Ikke forankret",
    queued: "Venter på forankring",
    proving: "Genererer privat bevis",
    failed: "Nytt forsøk planlagt",
    confirmed: "Forankret og bekreftet",
    revocation_queued: "Tilbakekalling venter",
    revocation_pending: "Tilbakekalling behandles",
    revocation_failed: "Nytt tilbakekallingsforsøk planlagt",
    revoked: "Forankret og tilbakekalt",
  })[value] || "Ikke forankret");
}

async function api(path, options = {}) {
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  const multipart = options.body instanceof FormData;
  if (options.body && typeof options.body !== "string" && !multipart) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  if (options.method && options.method !== "GET") headers["X-CSRF-Token"] = state.csrf;
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error(tr("Innlogging kreves"));
  }
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : { message: await response.text() };
  if (!response.ok) {
    const serverMessage = data.message || data.description || "";
    const error = new Error(serverMessage ? tr(serverMessage) : isEnglish() ? `The request failed (${response.status})` : `Forespørselen feilet (${response.status})`);
    error.data = data;
    throw error;
  }
  return data;
}

function notify(message, error = false) {
  const toast = byId("toast");
  toast.textContent = tr(message);
  toast.className = `toast${error ? " error" : ""}`;
  toast.hidden = false;
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => { toast.hidden = true; }, 4200);
}

function setConnectionState(mode = "online") {
  const element = byId("syncState");
  if (!element) return;
  const status = ({
    online: "Synkronisert",
    syncing: "Synkroniserer",
    offline: "Frakoblet · lokalt lagret",
    error: "Synkronisering feilet",
  })[mode] || "Synkronisert";
  element.className = `midnight-network ${mode}`;
  element.dataset.connection = mode;
  element.title = `${tr("Midnight aktivert på preprod")} · ${tr(status)}`;
  element.setAttribute("aria-label", element.title);
}

function activeMembership() {
  return state.memberships.find((item) => item.organization_id === state.activeOrgId) || null;
}

function activeRoles() {
  return new Set(activeMembership()?.roles || []);
}

function canProvide() {
  const roles = activeRoles();
  return roles.has("admin") || roles.has("task_provider");
}

function canReviewCurrent() {
  if (!state.current) return false;
  const roles = new Set(state.current.user_roles || []);
  const organizationRoles = activeRoles();
  return roles.has("reviewer") || roles.has("task_provider") || organizationRoles.has("admin") || organizationRoles.has("task_provider") || organizationRoles.has("reviewer");
}

function orgAssignments() {
  return state.assignments.filter((item) => item.organization_id === state.activeOrgId);
}

function visibleDocumentPackages() {
  if (!state.memberships.length) return state.document_packages || [];
  if (!state.activeOrgId) return [];
  return (state.document_packages || []).filter((item) => item.organization_id === state.activeOrgId);
}

function showView(name) {
  if (name === "sources") {
    state.settingsTab = "sources";
    name = "settings";
  }
  if (!state.memberships.length && name !== "settings") {
    name = (state.document_packages || []).length ? "documentation" : "emptyOrganization";
  }
  if (name === "members") state.settingsTab = "access";
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelectorAll(".primary-nav button").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  byId("settingsButton").classList.toggle("active", name === "settings" || name === "members");
  const target = byId(`${name}View`);
  if (target) target.classList.add("active");
  if (name !== "assignment") state.lastListView = name;
  if (name === "members") loadMembers();
  if (name === "settings") { renderIdentity(); showSettingsTab(state.settingsTab); }
  window.scrollTo({ top: 0, behavior: "auto" });
}

function renderIdentity() {
  const initials = state.user?.name?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?";
  byId("profileButton").textContent = initials;
  byId("profileButton").title = `${state.user.name} · ${state.user.email}`;
  byId("profileEmailDisplay").value = state.user.email || "";
  byId("displayNameInput").value = state.user.name || "";
  byId("roleTitleInput").value = state.user.profile?.role_title || "";
  byId("primaryFamilyInput").value = state.user.profile?.primary_family || "";
  byId("phoneInput").value = state.user.profile?.phone || "";
}

function renderOrganizationSettings() {
  const membership = activeMembership();
  if (!membership) return;
  const profile = membership.organization_profile || {};
  byId("organizationSettingsName").value = membership.organization_name || "";
  byId("organizationSettingsType").value = membership.organization_type || "other";
  byId("organizationNumberInput").value = profile.organization_number || "";
  byId("organizationAddressInput").value = profile.address || "";
  byId("organizationContactEmailInput").value = profile.contact_email || "";
  byId("organizationPhoneInput").value = profile.phone || "";
}

function showSettingsTab(requestedTab) {
  const tab = requestedTab === "organization" && !activeRoles().has("admin") ? "profile" : requestedTab;
  state.settingsTab = ["profile", "organization", "access", "sources"].includes(tab) ? tab : "profile";
  document.querySelectorAll("[data-settings-tab]").forEach((button) => {
    const active = button.dataset.settingsTab === state.settingsTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-settings-panel]").forEach((panel) => {
    const active = panel.dataset.settingsPanel === state.settingsTab;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
  if (state.settingsTab === "organization") renderOrganizationSettings();
  if (state.settingsTab === "access" && state.activeOrgId) loadMembers();
}

function openSettings(tab = "profile") {
  state.settingsTab = tab;
  showView("settings");
}

function renderOrganizationSummary() {
  const membership = activeMembership();
  const element = byId("organizationSummary");
  if (!membership || !element) return;
  const profile = membership.organization_profile || {};
  const contact = [profile.contact_email, profile.phone].filter(Boolean).join(" · ") || tr("Ikke oppgitt");
  element.innerHTML = `<div><span>${escapeHtml(tr("Organisasjon"))}</span><strong>${escapeHtml(membership.organization_name)}</strong><small>${escapeHtml(organizationTypeLabel(membership.organization_type))}</small></div>
    <div><span>${escapeHtml(tr("Organisasjonsnummer"))}</span><strong>${escapeHtml(profile.organization_number || tr("Ikke oppgitt"))}</strong><small>${escapeHtml(profile.address || "")}</small></div>
    <div><span>${escapeHtml(tr("Kontakt"))}</span><strong>${escapeHtml(contact)}</strong><small>${escapeHtml(tr("Kun synlig for medlemmer"))}</small></div>`;
}

function renderOrganizations() {
  const nameDisplay = byId("organizationNameDisplay");
  const shell = document.querySelector(".app-shell");
  shell.classList.toggle("without-organization", !state.memberships.length);
  byId("createOrganizationTopButton").hidden = Boolean(state.memberships.length);
  if (!state.memberships.length) {
    const shared = state.document_packages || [];
    state.activeOrgId = shared[0]?.organization_id || "";
    nameDisplay.textContent = shared.length ? tr("Delt dokumentasjon") : tr("Ingen organisasjon");
    renderActiveRoles([], shared.length ? "Dokumentmottaker" : "Ingen organisasjon");
    byId("newAssignmentButton").hidden = true;
    byId("newAssignmentListButton").hidden = true;
    byId("inviteMemberButton").hidden = true;
    byId("editOrganizationButton").hidden = true;
    byId("organizationSettingsTab").hidden = true;
    byId("topbarAssistant").hidden = true;
    showView(shared.length ? "documentation" : "emptyOrganization");
    return;
  }
  if (!state.memberships.some((item) => item.organization_id === state.activeOrgId)) state.activeOrgId = state.memberships[0].organization_id;
  localStorage.setItem("esense-active-org-v1", state.activeOrgId);
  nameDisplay.textContent = activeMembership()?.organization_name || tr("Ingen organisasjon");
  renderActiveRoles(activeMembership()?.roles || []);
  byId("newAssignmentButton").hidden = !canProvide();
  byId("newAssignmentListButton").hidden = !canProvide();
  byId("inviteMemberButton").hidden = !activeRoles().has("admin");
  byId("editOrganizationButton").hidden = !activeRoles().has("admin");
  byId("organizationSettingsTab").hidden = !activeRoles().has("admin");
  byId("settingsMemberCount").textContent = `${state.members.length || 0} ${tr("medlemmer")}`;
  renderOrganizationSummary();
}

function assignmentCard(item, options = {}) {
  const hideStatus = Boolean(options.hideAvailableStatus && item.is_available);
  const assignedName = item.assigned_worker?.display_name || item.assigned_worker?.email || "";
  const ownershipStatus = item.is_available
    ? { text: tr("Ikke tildelt"), className: "unassigned" }
    : item.status === "published" && assignedName
      ? { text: `${tr("Tildelt")}: ${assignedName}`, className: "assigned-worker" }
      : { text: statusLabel(item.status), className: item.status };
  const status = hideStatus ? "" : `<span class="status-badge ${escapeHtml(ownershipStatus.className)}">${escapeHtml(ownershipStatus.text)}</span>`;
  return `<button class="assignment-card${hideStatus ? " no-status" : ""}" type="button" data-assignment-id="${escapeHtml(item.id)}">
    <span class="card-title"><strong translate="no">${escapeHtml(item.title)}</strong></span>
    <span class="card-meta"><strong>${escapeHtml(tr("Omfatter"))}</strong><span>${escapeHtml((item.work_families || []).map((family) => family === "ekom" ? "Ekom" : "Elektro").join(" + "))}</span></span>
    ${status}
    <span class="card-arrow" aria-hidden="true">›</span>
  </button>`;
}

function renderList(element, items, emptyText, options = {}) {
  element.innerHTML = items.length ? items.map((item) => assignmentCard(item, options)).join("") : `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
}

function renderOverview() {
  const items = orgAssignments();
  const organizationRoles = activeRoles();
  const managerView = canProvide();
  const reviewerView = !managerView && organizationRoles.has("reviewer");
  const available = items.filter((item) => item.is_available);
  const mine = items.filter((item) => item.user_roles?.includes("assigned_worker") && !["completed", "closed", "cancelled", "declined"].includes(item.status));
  const review = items.filter((item) => ["submitted", "completion_submitted"].includes(item.status) && (item.user_roles?.some((role) => ["reviewer", "task_provider"].includes(role)) || canProvide()));
  const provided = items.filter((item) => !["closed", "cancelled"].includes(item.status) && (item.provider_id === state.user.id || canProvide())).slice(0, 6);
  const accepted = items.filter((item) => ["accepted_plan", "in_execution", "completion_submitted", "completion_returned", "completed"].includes(item.status)).length;
  const packages = visibleDocumentPackages();
  const activeCount = items.filter((item) => !["closed", "cancelled"].includes(item.status)).length;
  const metrics = managerView
    ? [["Aktive oppdrag", activeCount], ["Ledige oppdrag", available.length], ["Til vurdering", review.length], ["Dokumentpakker", packages.length]]
    : reviewerView
      ? [["Til vurdering", review.length], ["Tildelt meg", mine.length], ["Dokumentpakker", packages.length]]
      : [["Ledige oppdrag", available.length], ["Tildelt meg", mine.length], ["Dokumentpakker", packages.length]];
  byId("metricRow").innerHTML = metrics.map(([label, value]) => `<div class="metric"><span>${escapeHtml(tr(label))}</span><strong>${value}</strong></div>`).join("");
  byId("overviewTitle").textContent = tr(managerView ? "Oversikt" : reviewerView ? "Til vurdering" : "Mine oppdrag");
  const showMine = (!managerView && !reviewerView) || mine.length > 0;
  const showReview = managerView || reviewerView || review.length > 0;
  const showAvailable = (organizationRoles.has("worker") || managerView) && (available.length > 0 || !managerView);
  byId("availableWorkSection").hidden = !showAvailable;
  byId("myWorkSection").hidden = !showMine;
  byId("reviewQueueSection").hidden = !showReview;
  byId("providedAssignmentsSection").hidden = !managerView;
  byId("overviewColumns").classList.toggle("single-column", Number(showAvailable) + Number(showMine) + Number(showReview) < 2);
  const acceptedWithoutPackage = items.filter((item) => item.status === "completed" && !packages.some((pkg) => pkg.assignment_id === item.id));
  const isFirstOwnerVisit = items.length === 0 && canProvide();
  const next = review.length
    ? { title: isEnglish() ? `Review ${review.length} submitted ${review.length === 1 ? "version" : "versions"}` : `Vurder ${review.length} innsendt${review.length === 1 ? " versjon" : "e versjoner"}`, text: tr("Godkjenn eller returner planen eller utførelsesregistreringen før arbeidet går videre."), action: "assignment", assignmentId: review[0].id }
    : mine.length
      ? { title: isEnglish() ? `Continue with ${mine[0].title}` : `Fortsett med ${mine[0].title}`, text: tr("Dokumentasjonshjelperen viser manglende avklaringer i oppdraget."), action: "assignment", assignmentId: mine[0].id }
      : available.length && organizationRoles.has("worker")
        ? { title: tr("Se ledige oppdrag"), text: tr("Velg et oppdrag som passer kapasiteten og kompetansen din."), action: "assignment", assignmentId: available[0].id }
      : acceptedWithoutPackage.length && canProvide()
        ? { title: isEnglish() ? `Prepare documentation for ${acceptedWithoutPackage[0].title}` : `Klargjør dokumentasjon for ${acceptedWithoutPackage[0].title}`, text: tr("Planen er godkjent og kan nå følges av en kontrollert dokumentasjonspakke."), action: "assignment", assignmentId: acceptedWithoutPackage[0].id }
        : isFirstOwnerVisit
          ? {
            title: tr("Inviter den første personen"),
            text: tr("Gi en arbeidstaker, oppdragsgiver eller vurderer tilgang, eller opprett det første oppdraget selv."),
            action: "invite",
          }
          : {
          title: tr("Ingen utestående handlinger"),
          text: accepted
            ? isEnglish()
              ? `${accepted} approved ${accepted === 1 ? "plan is" : "plans are"} available${packages.length ? ` and ${packages.length} documentation ${packages.length === 1 ? "package has" : "packages have"} been issued` : ""}.`
              : `${accepted} godkjent${accepted === 1 ? " plan" : "e planer"} er tilgjengelig${packages.length ? ` og ${packages.length} dokumentpakke${packages.length === 1 ? "" : "r"} er utstedt` : ""}.`
            : tr("Opprett et oppdrag når neste arbeid skal planlegges."),
          action: "none",
        };
  const helper = byId("topbarAssistant");
  helper.hidden = next.action === "none";
  helper.dataset.nextAction = next.action;
  helper.dataset.assignmentId = next.assignmentId || "";
  helper.title = next.text;
  byId("topbarAssistantTitle").textContent = next.title;
  renderList(byId("availableAssignments"), available, "Ingen ledige oppdrag nå.", { hideAvailableStatus: true });
  renderList(byId("myAssignments"), mine, "Ingen oppdrag venter på deg.");
  renderList(byId("reviewQueue"), review, "Ingen planer venter på vurdering.");
  renderList(byId("providedAssignments"), provided, "Ingen oppdrag er opprettet ennå.", { unassignedLabel: true });
}

function filteredAssignments() {
  const items = orgAssignments();
  if (state.assignmentFilter === "available") return items.filter((item) => item.is_available);
  if (state.assignmentFilter === "mine") return items.filter((item) => item.user_roles?.includes("assigned_worker"));
  if (state.assignmentFilter === "review") return items.filter((item) => ["submitted", "completion_submitted"].includes(item.status) && (item.user_roles?.some((role) => ["reviewer", "task_provider"].includes(role)) || canProvide()));
  if (state.assignmentFilter === "closed") return items.filter((item) => ["completed", "closed", "cancelled", "declined"].includes(item.status));
  return items;
}

function renderAssignments() {
  const items = orgAssignments();
  byId("assignmentCount").textContent = items.length;
  renderList(byId("allAssignments"), filteredAssignments(), "Ingen oppdrag i dette filteret.");
}

function sidebarAssignmentStep(item) {
  if (item.status === "completed") return 5;
  if (["accepted_plan", "in_execution", "completion_submitted", "completion_returned"].includes(item.status)) return 4;
  if (item.status === "submitted") return 3;
  if (["accepted", "in_planning", "returned"].includes(item.status)) return 2;
  return 1;
}

function renderSidebarAssignments() {
  const section = byId("sidebarJobsSection");
  const list = byId("sidebarAssignments");
  if (!section || !list) return;
  const items = orgAssignments()
    .filter((item) => item.user_roles?.includes("assigned_worker") && !["closed", "cancelled", "declined"].includes(item.status))
    .sort((left, right) => {
      const priority = { returned: 0, published: 1, accepted: 2, in_planning: 2, submitted: 3, accepted_plan: 4 };
      const statusDifference = (priority[left.status] ?? 9) - (priority[right.status] ?? 9);
      if (statusDifference) return statusDifference;
      return String(right.created_at || "").localeCompare(String(left.created_at || ""));
    });
  const isWorker = activeRoles().has("worker") || items.length > 0;
  section.hidden = !isWorker;
  if (!isWorker) return;
  if (!items.length) {
    list.innerHTML = `<div class="sidebar-jobs-empty">${escapeHtml(tr("Ingen aktive oppdrag"))}</div>`;
    return;
  }
  list.innerHTML = items.map((item) => {
    const step = sidebarAssignmentStep(item);
    const current = state.current?.assignment?.id === item.id;
    return `<button class="sidebar-assignment${current ? " current" : ""}" type="button" data-assignment-id="${escapeHtml(item.id)}"${current ? ' aria-current="page"' : ""}>
      <span class="sidebar-assignment-step" aria-label="${escapeHtml(`${tr("Steg")} ${step} ${tr("av")} 5`)}">${String(step).padStart(2, "0")}</span>
      <span class="sidebar-assignment-copy"><strong translate="no">${escapeHtml(item.title)}</strong><small>${escapeHtml(statusLabel(item.status))}</small></span>
    </button>`;
  }).join("");
}

function renderSources() {
  const status = policyStatusLabel(state.policy?.status);
  byId("policyVersion").textContent = `Kildepakke ${state.policy?.version || "-"} · ${status}`;
  byId("sourceSummary").innerHTML = `<div><span>Pakke</span><strong>${escapeHtml(state.policy?.id || "-")}</strong></div><div><span>Versjon</span><strong>${escapeHtml(state.policy?.version || "-")}</strong></div><div><span>Status</span><strong>${escapeHtml(status)}</strong></div>`;
}

function documentPackageCard(item) {
  const assignmentAvailable = state.assignments.some((assignment) => assignment.id === item.assignment_id);
  const grants = (item.grants || []).map((grant) => {
    const accessStatus = grant.status === "revoked" ? "Trukket tilbake" : grant.expired ? "Utløpt" : grant.expires_at ? `Til ${formatDate(grant.expires_at)}` : "Varig tilgang";
    const revoke = item.can_manage && grant.status === "active" && !grant.expired ? `<button class="text-button danger-text" type="button" data-revoke-grant="${escapeHtml(grant.id)}" data-package-id="${escapeHtml(item.id)}">Trekk tilgang</button>` : "";
    return `<li><strong>${escapeHtml(grantTypeLabel(grant.grant_type))}</strong><span translate="no">${escapeHtml(grant.recipient_email)}</span><small>${escapeHtml(accessStatus)}</small>${revoke}</li>`;
  }).join("");
  const controls = [
    assignmentAvailable ? `<button class="secondary compact-button document-action-button" type="button" data-open-assignment="${escapeHtml(item.assignment_id)}">Åpne oppdrag</button>` : "",
    item.content_status === "available" ? `<button class="secondary compact-button document-action-button" type="button" data-open-document="${escapeHtml(item.id)}">Vis dokument</button>` : "",
    `<button class="secondary compact-button document-action-button" type="button" data-verify-package="${escapeHtml(item.id)}">Kontroller</button>`,
    item.can_manage && item.status !== "revoked" ? `<button class="primary compact-button document-action-button" type="button" data-share-package="${escapeHtml(item.id)}">Gi tilgang</button>` : "",
  ].join("");
  const contentWarning = item.content_status === "unreadable" ? '<div class="document-warning">Det beskyttede innholdet kan ikke åpnes. Kontroller dokumentnøkkelen før videre bruk.</div>' : "";
  const demonstration = item.is_demonstration ? '<div class="document-demo"><strong>Syntetisk demonstrasjon</strong><span>Opplysninger og måleverdier gjelder ikke et virkelig anlegg.</span></div>' : "";
  return `<details class="document-card document-row">
    <summary class="document-row-summary"><span class="document-row-date">${escapeHtml(formatDate(item.issued_at))}</span><span class="document-row-title"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.assignment_title || item.property_reference || "")}</small></span><span class="document-row-midnight">${midnightMark()}<strong>${escapeHtml(midnightStatusLabel(item.midnight_status))}</strong></span><span class="status-badge ${escapeHtml(item.status)}">${escapeHtml(packageStatusLabel(item.status))}</span><span class="document-row-chevron" aria-hidden="true">⌄</span></summary>
    <div class="document-row-body">
    <div class="document-card-main"><div class="document-title" translate="no"><span>${escapeHtml(item.organization_name)} · ${escapeHtml(item.property_reference)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p></div><span class="status-badge ${escapeHtml(item.status)}">${escapeHtml(packageStatusLabel(item.status))}</span></div>
    ${demonstration}
    ${contentWarning}
    <div class="receipt-facts"><div><span>Utstedt</span><strong>${escapeHtml(formatDate(item.issued_at))}</strong></div><div><span>Integritet</span><strong>Lokalt signert</strong></div><div class="midnight-fact"><span>${midnightMark()}</span><strong>${escapeHtml(midnightStatusLabel(item.midnight_status))}</strong></div><div><span>Kvittering</span><code>${escapeHtml(item.commitment.slice(0, 14))}…</code></div></div>
    ${grants ? `<ul class="grant-list">${grants}</ul>` : ""}
    <div class="document-card-actions">${controls}</div>
    </div>
  </details>`;
}

function demoRecipientLabel(value) {
  return tr(({
    owner: "Bygningseier",
    contractor: "Ny utførende virksomhet",
    authority: "Myndighet eller tilsyn",
  })[value] || "Demomottaker");
}

function demoRecipientPurpose(value) {
  return tr(({
    owner: "Drift, vedlikehold, forsikring og senere endringer",
    contractor: "Planlegging av en godkjent endring i eksisterende anlegg",
    authority: "Tilsyn med gyldig rettslig grunnlag",
  })[value] || "Avgrenset demonstrasjonsformål");
}

function demoDurationLabel(value, expiresAt = "") {
  if (value === "persistent") return tr("Varig tilgang");
  if (value === "time_limited") return expiresAt ? `${tr("Til")} ${formatDate(expiresAt)}` : tr("30 dagers tilgang");
  return expiresAt ? `${tr("Til")} ${formatDate(expiresAt)}` : tr("Saksavgrenset tilgang");
}

function demoReportPath() {
  return `/${isEnglish() ? "en" : "no"}/demo-report`;
}

function demoPackageForArchive() {
  const demo = state.demo_documentation;
  if (!demo?.receipt || !demo?.report) return null;
  const recipients = demo.access?.recipients || [];
  return {
    id: demo.receipt.package_id,
    organization_name: "FieldSeal demo",
    customer_id: "esense-synthetic-demo-property",
    customer_name: tr("Demoeier (syntetisk)"),
    customer_address: tr("Syntetisk bolig, Bradenton, Florida"),
    property_reference: demo.report.property_reference,
    assignment_title: tr("Demooppdrag: installasjon av elbillader"),
    work_families: ["electro"],
    title: tr("Utstedt rapportpakke"),
    summary: tr("Komplett, syntetisk overlevering med lastberegning, kontrollresultater, panelmerking, produktdata og idriftsetting."),
    status: demo.receipt.status,
    issued_at: demo.receipt.issued_at,
    commitment: demo.receipt.commitment,
    midnight_status: demo.midnight?.status || "not_submitted",
    midnight: demo.midnight || {},
    integrity: demo.receipt.integrity || {},
    job_reference: demo.report.job_reference,
    is_archive_demo: true,
    grants: recipients.filter((recipient) => recipient.active).map((recipient) => ({
      recipient_email: demoRecipientLabel(recipient.key),
      grant_type: recipient.key,
      purpose: recipient.purpose,
      status: recipient.status,
      expires_at: recipient.expires_at,
      expired: recipient.status === "expired",
    })),
    demo_recipients: recipients,
  };
}

function demoDocumentPackageCard(item) {
  const grants = item.demo_recipients.filter((recipient) => recipient.active).map((recipient) => `<li><strong>${escapeHtml(demoRecipientLabel(recipient.key))}</strong><span>${escapeHtml(tr("Demotilgang aktiv"))}</span><small>${escapeHtml(demoDurationLabel(recipient.duration_kind, recipient.expires_at))}</small></li>`).join("");
  return `<details class="document-card document-row demo-archive-card">
    <summary class="document-row-summary"><span class="document-row-date">${escapeHtml(formatDate(item.issued_at))}</span><span class="document-row-title"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.job_reference)}</small></span><span class="document-row-midnight">${midnightMark()}<strong>${escapeHtml(midnightStatusLabel(item.midnight_status))}</strong></span><span class="status-badge issued">${escapeHtml(tr("Ferdig demo"))}</span><span class="document-row-chevron" aria-hidden="true">⌄</span></summary>
    <div class="document-row-body">
    <div class="document-card-main"><div class="document-title"><span>${escapeHtml(`FieldSeal demo · ${item.job_reference}`)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p></div><span class="status-badge issued">${escapeHtml(tr("Ferdig demo"))}</span></div>
    <div class="document-demo"><strong>${escapeHtml(tr("Syntetisk demonstrasjon"))}</strong><span>${escapeHtml(tr("Ingen personer, steder eller måleverdier gjelder et virkelig anlegg."))}</span></div>
    <div class="receipt-facts"><div><span>${escapeHtml(tr("Utstedt"))}</span><strong>${escapeHtml(formatDate(item.issued_at))}</strong></div><div><span>${escapeHtml(tr("Integritet"))}</span><strong>${escapeHtml(item.integrity.valid ? tr("Gyldig og uendret") : tr("Kan ikke bekreftes"))}</strong></div><div class="midnight-fact"><span>${midnightMark()}</span><strong>${escapeHtml(midnightStatusLabel(item.midnight_status))}</strong></div><div><span>${escapeHtml(tr("Kvittering"))}</span><code>${escapeHtml(item.commitment.slice(0, 14))}…</code></div></div>
    ${grants ? `<ul class="grant-list demo-grant-list">${grants}</ul>` : `<div class="demo-access-empty">${escapeHtml(tr("Ingen demomottakere har tilgang ennå."))}</div>`}
    <div class="document-card-actions"><a class="secondary compact-button document-action-button" href="${escapeHtml(demoReportPath())}" target="_blank" rel="noopener">${escapeHtml(tr("Åpne rapport"))}</a><button class="secondary compact-button document-action-button" type="button" data-verify-demo-package>${escapeHtml(tr("Kontroller"))}</button><button class="primary compact-button document-action-button" type="button" data-open-demo-share>${escapeHtml(tr("Vis deling"))}</button></div>
    </div>
  </details>`;
}

function documentTimestamp(item) {
  const value = Date.parse(item.issued_at || item.created_at || "");
  return Number.isFinite(value) ? value : 0;
}

function sortDocumentPackages(items) {
  const mode = byId("documentSortFilter")?.value || "newest";
  return [...items].sort((left, right) => {
    if (mode === "anchored") {
      const anchorDifference = Number(right.midnight_status === "confirmed") - Number(left.midnight_status === "confirmed");
      if (anchorDifference) return anchorDifference;
    }
    const dateDifference = documentTimestamp(right) - documentTimestamp(left);
    return mode === "oldest" ? -dateDifference : dateDifference;
  });
}

function documentWorkFamilies(item) {
  const families = Array.isArray(item.work_families) ? item.work_families : [];
  const valid = [...new Set(families.filter((family) => family === "electro" || family === "ekom"))];
  return valid.length ? valid : ["other"];
}

function documentWorkFamilyLabel(family) {
  return family === "electro" ? tr("Elektro") : family === "ekom" ? tr("Ekom") : tr("Annet");
}

function renderDocumentation() {
  const demoItem = demoPackageForArchive();
  const allItems = [...(demoItem ? [demoItem] : []), ...visibleDocumentPackages()];
  const customerFilter = byId("documentCustomerFilter");
  const selectedCustomer = customerFilter.value;
  const customers = [...new Map(allItems.filter((item) => item.customer_id || item.customer_name).map((item) => [item.customer_id || item.customer_name, item.customer_name || item.property_reference])).entries()]
    .sort((left, right) => left[1].localeCompare(right[1], activeLocale()));
  customerFilter.innerHTML = `<option value="">${escapeHtml(tr("Alle kunder og anlegg"))}</option>${customers.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("")}`;
  customerFilter.value = customers.some(([value]) => value === selectedCustomer) ? selectedCustomer : "";
  const query = byId("documentSearchInput").value.trim().toLocaleLowerCase(activeLocale());
  const midnightFilter = byId("documentMidnightFilter").value;
  const pendingStatuses = new Set(["queued", "proving", "failed", "revocation_queued", "revocation_pending", "revocation_failed"]);
  const items = allItems.filter((item) => {
    const searchable = [item.title, item.customer_name, item.customer_address, item.property_reference, item.owner_email, ...documentWorkFamilies(item).map(documentWorkFamilyLabel), ...(item.grants || []).map((grant) => grant.recipient_email)].join(" ").toLocaleLowerCase(activeLocale());
    const customerMatches = !customerFilter.value || (item.customer_id || item.customer_name) === customerFilter.value;
    const midnightMatches = !midnightFilter
      || (midnightFilter === "pending" ? pendingStatuses.has(item.midnight_status) : item.midnight_status === midnightFilter);
    return (!query || searchable.includes(query)) && customerMatches && midnightMatches;
  });
  byId("documentCount").textContent = allItems.length;
  const confirmed = allItems.filter((item) => item.midnight_status === "confirmed").length;
  const recipients = new Set(allItems.flatMap((item) => (item.grants || []).filter((grant) => grant.status === "active" && !grant.expired).map((grant) => grant.recipient_email))).size;
  byId("documentSummary").innerHTML = `<span><strong>${allItems.length}</strong> ${escapeHtml(tr("dokumentpakker"))}</span><span><strong>${confirmed}</strong> ${escapeHtml(tr("forankret"))}</span><span><strong>${recipients}</strong> ${escapeHtml(tr("aktive mottakere"))}</span>`;
  byId("documentationMidnightStatus").textContent = confirmed ? tr("Forankret og bekreftet") : tr("Ikke forankret");
  byId("documentationMidnightDetail").textContent = confirmed ? `${confirmed} ${tr(confirmed === 1 ? "bekreftet pakke" : "bekreftede pakker")}` : tr("Pilotstatus");
  if (!items.length) {
    byId("documentArchiveList").innerHTML = '<div class="empty-state">Ingen dokumentasjon samsvarer med filteret.</div>';
    return;
  }
  const groups = new Map();
  sortDocumentPackages(items).forEach((item) => {
    const key = item.customer_id || item.customer_name || item.property_reference || tr("Uten kunde eller anlegg");
    const label = item.customer_name || item.property_reference || tr("Uten kunde eller anlegg");
    if (!groups.has(key)) groups.set(key, { label, address: item.customer_address || "", workGroups: new Map(), itemCount: 0 });
    const group = groups.get(key);
    group.jobs = group.workGroups;
    documentWorkFamilies(item).forEach((family) => {
      if (!group.workGroups.has(family)) group.workGroups.set(family, { label: documentWorkFamilyLabel(family), reference: "", items: [] });
      group.workGroups.get(family).items.push(item);
    });
    group.itemCount += 1;
  });
  byId("documentArchiveList").innerHTML = [...groups.values()].map((group) => `<section class="document-customer-group"><div class="document-group-heading"><div><h3>${escapeHtml(group.label)}</h3>${group.address ? `<p>${escapeHtml(group.address)}</p>` : ""}</div><span>${group.itemCount} ${escapeHtml(tr(group.itemCount === 1 ? "dokument" : "dokumenter"))}</span></div><div class="document-job-list">${[...group.jobs.values()].map((job) => `<details class="document-job-group"><summary class="document-job-summary"><strong>${escapeHtml(job.label)}</strong>${job.reference ? `<code>${escapeHtml(job.reference)}</code>` : ""}<span>${job.items.length} ${escapeHtml(tr(job.items.length === 1 ? "dokument" : "dokumenter"))}</span><b aria-hidden="true">⌄</b></summary><div class="document-job-documents"><div class="document-list">${job.items.map((item) => item.is_archive_demo ? demoDocumentPackageCard(item) : documentPackageCard(item)).join("")}</div></div></details>`).join("")}</div></section>`).join("");
}

function renderAll() {
  renderOrganizations();
  if (!state.activeOrgId) return;
  renderOverview();
  renderAssignments();
  renderSidebarAssignments();
  renderDocumentation();
  renderSources();
  if (!byId("assignmentView").classList.contains("active")) showView(state.lastListView || "overview");
}

async function loadBootstrap() {
  const data = await api("/api/bootstrap");
  Object.assign(state, data);
  try {
    const [demo, access] = await Promise.all([
      api("/api/public/midnight-demo"),
      api("/api/midnight-demo/access"),
    ]);
    state.demo_documentation = { ...demo, access };
  } catch (_error) {
    state.demo_documentation = null;
  }
  renderIdentity();
  renderAll();
}

async function loadMembers() {
  if (!state.activeOrgId) return;
  try {
    const data = await api(`/api/organizations/${encodeURIComponent(state.activeOrgId)}/members`);
    state.members = data.members || [];
    byId("settingsMemberCount").textContent = `${state.members.length} ${tr("medlemmer")}`;
    if (!state.members.some((member) => member.id === state.selectedMemberId)) {
      state.selectedMemberId = state.members.find((member) => member.user_id === state.user.id)?.id || state.members[0]?.id || "";
    }
    const activeWorkers = state.members.filter((member) => member.status === "active" && (member.roles || []).includes("worker"));
    renderMembers();
    byId("assigneesInput").innerHTML = `<option value="">${escapeHtml(tr("Ikke tildelt – tilgjengelig for arbeidstakere"))}</option>${activeWorkers.map((member) => `<option value="${escapeHtml(member.email)}">${escapeHtml(member.display_name || member.email)}${member.display_name ? ` · ${escapeHtml(member.email)}` : ""}</option>`).join("")}`;
  } catch (error) {
    notify(error.message, true);
  }
}

function renderMembers() {
  const list = byId("memberList");
  if (!state.members.length) {
    list.innerHTML = '<div class="empty-state">Ingen personer er lagt til.</div>';
    byId("memberDetail").innerHTML = '<div class="empty-state">Inviter den første personen til organisasjonen.</div>';
    return;
  }
  list.innerHTML = state.members.map((member) => {
    const selected = member.id === state.selectedMemberId;
    const initials = (member.display_name || member.email).split(/\s+|@/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    return `<button class="member-row${selected ? " selected" : ""}" type="button" data-member-id="${escapeHtml(member.id)}"${selected ? ' aria-current="true"' : ""}><span class="member-avatar">${escapeHtml(initials)}</span><span><strong translate="no">${escapeHtml(member.display_name || member.email)}</strong><small>${escapeHtml(member.profile?.role_title || member.email)}</small></span><span class="member-state">${escapeHtml(member.status === "active" ? tr("Aktiv") : tr("Invitert"))}</span></button>`;
  }).join("");
  renderMemberDetail();
}

function renderMemberDetail() {
  const member = state.members.find((item) => item.id === state.selectedMemberId);
  if (!member) return;
  const ownMember = member.user_id === state.user.id;
  const canManageRoles = activeRoles().has("admin");
  const assignments = member.can_inspect
    ? member.assignments || []
    : ownMember ? orgAssignments() : [];
  const evidenceCount = member.can_inspect ? member.evidence_count : 0;
  const documentCount = member.can_inspect
    ? member.document_count
    : ownMember ? visibleDocumentPackages().filter((item) => assignments.some((assignment) => assignment.id === item.assignment_id)).length : 0;
  const assignmentMarkup = assignments.length ? assignments.map((assignment) => `<button class="member-assignment" type="button" data-open-assignment="${escapeHtml(assignment.id)}"><span><strong translate="no">${escapeHtml(assignment.title)}</strong><small translate="no">${escapeHtml(assignment.location_context || tr("Kunde eller anlegg ikke oppgitt"))}</small></span><span><b>${escapeHtml(statusLabel(assignment.status))}</b>${member.can_inspect ? `<small>${assignment.evidence_count || 0} ${escapeHtml(tr("registreringer"))} · ${assignment.document_count || 0} ${escapeHtml(tr("pakker"))}</small>` : ""}</span></button>`).join("") : '<div class="empty-state compact">Ingen tilknyttede oppdrag.</div>';
  const visibilityNote = member.can_inspect || ownMember ? "" : `<p class="member-privacy-note">${escapeHtml(tr("Du kan se medlemsopplysninger, men ikke andre personers oppdrag eller dokumentasjon."))}</p>`;
  const memberActions = `${ownMember ? `<button class="secondary compact-button" type="button" data-edit-profile>${escapeHtml(tr("Rediger profil"))}</button>` : ""}${canManageRoles ? `<button class="secondary compact-button" type="button" data-manage-member-roles="${escapeHtml(member.id)}">${escapeHtml(tr("Administrer roller"))}</button>` : ""}`;
  byId("memberDetail").innerHTML = `<div class="member-detail-header"><div><span class="eyebrow">${escapeHtml(member.status === "active" ? tr("Aktivt medlem") : tr("Invitert"))}</span><h2 translate="no">${escapeHtml(member.display_name || member.email)}</h2><p>${escapeHtml(member.email)}</p></div><div class="member-detail-actions">${memberActions}</div></div>
    <div class="member-facts"><div><span>${escapeHtml(tr("Rolle eller stilling"))}</span><strong>${escapeHtml(member.profile?.role_title || tr("Ikke oppgitt"))}</strong></div><div><span>${escapeHtml(tr("Primærfag"))}</span><strong>${escapeHtml(primaryFamilyLabel(member.profile?.primary_family))}</strong></div><div><span>${escapeHtml(tr("Organisasjonsroller"))}</span><strong>${escapeHtml((member.roles || []).map(roleLabel).join(" · ") || tr("Medlem"))}</strong></div></div>
    <div class="member-stats"><span><strong>${assignments.length}</strong>${escapeHtml(tr("oppdrag"))}</span><span><strong>${evidenceCount}</strong>${escapeHtml(tr("registreringer"))}</span><span><strong>${documentCount}</strong>${escapeHtml(tr("dokumentpakker"))}</span></div>
    ${visibilityNote}<div class="member-work"><h3>${escapeHtml(tr("Oppdrag og dokumentasjon"))}</h3>${assignmentMarkup}</div>`;
}

async function loadCustomers() {
  if (!state.activeOrgId) return;
  try {
    const data = await api(`/api/organizations/${encodeURIComponent(state.activeOrgId)}/customers`);
    state.customers = data.customers || [];
    byId("customerInput").innerHTML = `<option value="">${escapeHtml(tr("Velg kunde eller anlegg"))}</option>${state.customers.map((customer) => `<option value="${escapeHtml(customer.id)}">${escapeHtml(customer.name)}${customer.address ? ` · ${escapeHtml(customer.address)}` : ""}</option>`).join("")}<option value="__new__">+ ${escapeHtml(tr("Registrer ny kunde"))}</option>`;
    syncNewCustomerFields();
  } catch (error) {
    notify(error.message, true);
  }
}

function syncNewCustomerFields() {
  const isNew = byId("customerInput").value === "__new__";
  byId("newCustomerFields").hidden = !isNew;
  byId("newCustomerNameInput").disabled = !isNew;
  byId("newCustomerAddressInput").disabled = !isNew;
  byId("newCustomerNameInput").required = isNew;
}

function planningFromForm() {
  return Object.fromEntries(new FormData(byId("planningForm")).entries());
}

function fillPlanningForm(data) {
  for (const [name, value] of Object.entries(data || {})) {
    const field = byId("planningForm").elements.namedItem(name);
    if (field) field.value = value ?? "";
  }
}

function localDraftKey() {
  return state.current ? `esense-draft-v1:${state.current.assignment.id}` : "";
}

function storeLocalDraft() {
  if (!state.current || !state.current.user_roles.includes("assigned_worker")) return;
  localStorage.setItem(localDraftKey(), JSON.stringify({ data: planningFromForm(), saved_at: new Date().toISOString() }));
  byId("draftSaveState").textContent = navigator.onLine ? "Endringer på enheten" : "Lokalt lagret · frakoblet";
}

function completionFromForm() {
  return Object.fromEntries(new FormData(byId("completionForm")).entries());
}

function fillCompletionForm(data) {
  for (const [name, value] of Object.entries(data || {})) {
    const field = byId("completionForm").elements.namedItem(name);
    if (field) field.value = value ?? "";
  }
}

function completionLocalDraftKey() {
  return state.current ? `esense-completion-draft-v1:${state.current.assignment.id}` : "";
}

function requiredCompletionFields() {
  return ["work_performed", "safe_closure", "tests_and_results", "deviations", "evidence_references"];
}

function completionIsComplete() {
  const data = completionFromForm();
  return requiredCompletionFields().every((field) => String(data[field] || "").trim());
}

function storeLocalCompletionDraft() {
  if (!state.current || !state.current.user_roles.includes("assigned_worker")) return;
  localStorage.setItem(completionLocalDraftKey(), JSON.stringify({ data: completionFromForm(), saved_at: new Date().toISOString() }));
  byId("completionSaveState").textContent = navigator.onLine ? tr("Endringer på enheten") : tr("Lokalt lagret · frakoblet");
}

const assignmentStepTitles = {
  1: "Oppdrag",
  2: "Ansvar og planlegging",
  3: "Krav og sikkerhet",
  4: "Utførelse og sluttkontroll",
  5: "Dokumentasjon og overlevering",
};

function requiredPlanningFields() {
  return ["work_description", "work_method", "risk_controls", "tests_and_evidence", "open_questions"];
}

function planningIsComplete() {
  const data = planningFromForm();
  return requiredPlanningFields().every((field) => String(data[field] || "").trim());
}

function assignmentStepStorageKey() {
  return state.current ? `esense-assignment-step-v1:${state.current.assignment.id}` : "";
}

function recommendedAssignmentStep() {
  if (!state.current) return 1;
  const assignment = state.current.assignment;
  const worker = state.current.user_roles.includes("assigned_worker");
  if (assignment.status === "completed" || (state.current.document_packages || []).length) return 5;
  if (["accepted_plan", "in_execution", "completion_submitted", "completion_returned"].includes(assignment.status)) return 4;
  if (assignment.status === "submitted") return 3;
  if (assignment.status === "returned") return worker ? 2 : 3;
  if (worker && assignment.status !== "published") return 2;
  return 1;
}

function availableAssignmentSteps() {
  const worker = state.current?.user_roles?.includes("assigned_worker");
  return worker ? new Set([1, 2, 3, 4, 5]) : new Set([1, 3, 4, 5]);
}

function completedAssignmentSteps() {
  if (!state.current) return new Set();
  const status = state.current.assignment.status;
  const packages = state.current.document_packages || [];
  const planApproved = ["accepted_plan", "in_execution", "completion_submitted", "completion_returned", "completed", "closed"].includes(status);
  const completed = new Set();
  if (!["published", "declined", "cancelled"].includes(status)) completed.add(1);
  if ((state.current.user_roles.includes("assigned_worker") && planningIsComplete()) || ["submitted", "returned", "accepted_plan", "in_execution", "completion_submitted", "completion_returned", "completed", "closed"].includes(status)) completed.add(2);
  if (planApproved) completed.add(3);
  if (["completed", "closed"].includes(status)) completed.add(4);
  if (packages.some((item) => item.status === "issued")) completed.add(5);
  return completed;
}

function renderAssignmentStepper() {
  if (!state.current) return;
  const available = availableAssignmentSteps();
  const completed = completedAssignmentSteps();
  byId("assignmentStepCounter").textContent = `${tr("Steg")} ${String(state.assignmentStep).padStart(2, "0")} ${tr("av")} 05`;
  byId("assignmentStepTitle").textContent = tr(assignmentStepTitles[state.assignmentStep]);
  byId("assignmentProgressFill").style.width = `${state.assignmentStep * 20}%`;
  document.querySelectorAll("[data-assignment-step]").forEach((section) => {
    const active = Number(section.dataset.assignmentStep) === state.assignmentStep;
    section.hidden = !active;
    section.classList.toggle("step-active", active);
  });

  const navigation = byId("assignmentStepNavigation");
  const previous = [...available].filter((step) => step < state.assignmentStep && (step <= state.assignmentMaxStep || completed.has(step))).pop();
  let next = [...available].find((step) => step > state.assignmentStep);
  const planApproved = ["accepted_plan", "in_execution", "completion_submitted", "completion_returned", "completed", "closed"].includes(state.current.assignment.status);
  const completionApproved = ["completed", "closed"].includes(state.current.assignment.status) || (state.current.document_packages || []).length > 0;
  const canAdvance = state.assignmentStep === 2
    ? planningIsComplete()
    : state.assignmentStep === 3
      ? planApproved
      : state.assignmentStep === 4
        ? completionApproved
        : Boolean(next && (next <= state.assignmentMaxStep || completed.has(state.assignmentStep)));
  const previousButton = previous ? `<button class="secondary" type="button" data-assignment-step-go="${previous}">${escapeHtml(tr("Tilbake"))}</button>` : "";
  let nextButton = "";
  if (next && canAdvance) {
    const label = state.assignmentStep === 4 && !completed.has(4) ? "" : `<button class="primary" type="button" data-assignment-step-next="${next}">${escapeHtml(tr(state.assignmentStep === 5 ? "Ferdig" : "Fortsett"))}</button>`;
    nextButton = label;
  }
  if (state.assignmentStep === 1 && state.current.assignment.is_available) {
    nextButton = canProvide()
      ? `<button class="primary" type="button" data-assign-later>${escapeHtml(tr("Tildel"))}</button>`
      : activeRoles().has("worker")
        ? `<button class="primary" type="button" data-claim-assignment>${escapeHtml(tr("Ta oppdrag"))}</button>`
        : "";
  }
  navigation.innerHTML = previousButton + nextButton;
}

async function goToAssignmentStep(step, advancing = false) {
  if (!state.current) return;
  if (advancing && state.assignmentStep === 2) {
    const missing = requiredPlanningFields().filter((field) => !String(planningFromForm()[field] || "").trim());
    if (missing.length) {
      const field = byId("planningForm").elements.namedItem(missing[0]);
      field?.focus();
      notify(isEnglish() ? `Complete ${planningFieldLabel(missing[0])} before continuing.` : `Fullfør ${planningFieldLabel(missing[0])} før du fortsetter.`, true);
      return;
    }
    await saveDraft(false);
  }
  state.assignmentMaxStep = Math.max(state.assignmentMaxStep, step);
  state.assignmentStep = step;
  localStorage.setItem(assignmentStepStorageKey(), String(state.assignmentMaxStep));
  renderAssignmentStepper();
  byId("assignmentSteps").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveDraft(showMessage = true) {
  if (!state.current || !state.current.user_roles.includes("assigned_worker")) return;
  const data = planningFromForm();
  storeLocalDraft();
  if (!navigator.onLine) {
    setConnectionState("offline");
    if (showMessage) notify("Arbeidskopien er lagret på enheten og synkroniseres senere.");
    return;
  }
  byId("draftSaveState").textContent = "Synkroniserer ...";
  setConnectionState("syncing");
  try {
    const result = await api(`/api/assignments/${encodeURIComponent(state.current.assignment.id)}/draft`, { method: "PUT", body: data });
    localStorage.removeItem(localDraftKey());
    state.current.draft = data;
    state.current.considerations = result.considerations || [];
    byId("draftSaveState").textContent = `${tr("Synkronisert")} ${new Date(result.updated_at).toLocaleTimeString(activeLocale(), { hour: "2-digit", minute: "2-digit" })}`;
    setConnectionState("online");
    renderConsiderations();
    if (showMessage) notify("Arbeidskopien er synkronisert.");
  } catch (error) {
    byId("draftSaveState").textContent = "Lokalt lagret · synkronisering feilet";
    setConnectionState("error");
    if (showMessage) notify(error.message, true);
  }
}

async function saveCompletion(showMessage = true) {
  if (!state.current || !state.current.user_roles.includes("assigned_worker")) return;
  const editable = ["accepted_plan", "in_execution", "completion_returned"].includes(state.current.assignment.status);
  if (!editable) return;
  const data = completionFromForm();
  storeLocalCompletionDraft();
  if (!navigator.onLine) {
    setConnectionState("offline");
    if (showMessage) notify("Utførelsesregistreringen er lagret på enheten og synkroniseres senere.");
    return;
  }
  byId("completionSaveState").textContent = tr("Synkroniserer ...");
  setConnectionState("syncing");
  try {
    const result = await api(`/api/assignments/${encodeURIComponent(state.current.assignment.id)}/completion-draft`, { method: "PUT", body: data });
    localStorage.removeItem(completionLocalDraftKey());
    state.current.completion_draft = data;
    state.current.completion_draft_updated_at = result.updated_at;
    state.current.assignment.status = result.status;
    byId("completionSaveState").textContent = `${tr("Synkronisert")} ${new Date(result.updated_at).toLocaleTimeString(activeLocale(), { hour: "2-digit", minute: "2-digit" })}`;
    byId("assignmentStatus").textContent = statusLabel(result.status);
    byId("assignmentStatus").className = `status-badge ${result.status}`;
    setConnectionState("online");
    renderSidebarAssignments();
    if (showMessage) notify("Utførelsesregistreringen er synkronisert.");
  } catch (error) {
    byId("completionSaveState").textContent = tr("Lokalt lagret · synkronisering feilet");
    setConnectionState("error");
    if (showMessage) notify(error.message, true);
  }
}

function renderAssignmentSummary() {
  const assignment = state.current.assignment;
  const evidence = state.current.evidence || [];
  const workers = assignment.assigned_workers || (assignment.assigned_worker ? [assignment.assigned_worker] : []);
  const workerNames = workers.map((worker) => worker.display_name || worker.email).join(", ") || tr("Ikke tildelt");
  const responsible = assignment.professional_responsible_user;
  const responsibleName = responsible?.display_name || responsible?.email || assignment.professional_responsible || tr("Ikke tildelt");
  const manageButton = canProvide() && !["closed", "completed", "cancelled", "declined"].includes(assignment.status)
    ? `<button class="secondary compact-button summary-assign-button" type="button" data-assign-later>${escapeHtml(tr("Administrer"))}</button>`
    : "";
  const evidenceButton = canRegisterEvidence() ? `<button class="secondary summary-evidence-button" type="button" data-open-evidence>${escapeHtml(tr("Legg til dokumentasjon"))}</button>` : "";
  byId("assignmentSummary").innerHTML = `<div class="summary-block"><span>Omfatter</span><strong>${escapeHtml(assignment.work_families.map((family) => family === "ekom" ? "Ekom" : "Elektro").join(" + "))}</strong></div><div class="summary-block"><span>${escapeHtml(tr("Arbeidslag"))}</span><div class="summary-value-row"><strong translate="no">${escapeHtml(workerNames)}</strong>${manageButton}</div></div><div class="summary-block"><span>${escapeHtml(tr("AFA / faglig ansvarlig"))}</span><strong translate="no">${escapeHtml(responsibleName)}</strong></div><div class="summary-block"><span>Opprettet</span><strong>${escapeHtml(formatDateTime(assignment.created_at))}</strong></div><div class="summary-block"><span>Dokumentasjon</span><strong>${evidence.length}</strong>${evidenceButton}</div><div class="summary-block"><span>Oppdragsversjon</span><strong>v${assignment.version}</strong></div>`;
}

function canRegisterEvidence() {
  if (!state.current || !state.user) return false;
  return state.current.user_roles.includes("assigned_worker")
    || state.current.assignment.provider_id === state.user.id
    || activeRoles().has("admin")
    || activeRoles().has("task_provider");
}

function evidenceTimelineItem(item) {
  const file = item.download_url
    ? `<a class="evidence-file" href="${escapeHtml(item.download_url)}">${escapeHtml(item.original_filename || tr("Åpne fil"))}</a>`
    : "";
  return `<article class="evidence-entry phase-${escapeHtml(item.phase)}"><div class="evidence-marker" aria-hidden="true"></div><div class="evidence-entry-body"><div class="evidence-entry-heading"><div><span>${escapeHtml(evidencePhaseLabel(item.phase))} · ${escapeHtml(evidenceTypeLabel(item.evidence_type))}</span><strong translate="no">${escapeHtml(item.title)}</strong></div><time>${escapeHtml(formatDateTime(item.registered_at))}</time></div>${item.note ? `<p translate="no">${escapeHtml(item.note)}</p>` : ""}<div class="evidence-meta"><span translate="no">${escapeHtml(item.registered_by_name)}</span>${file}<span class="evidence-commitment">${midnightMark()}<code>${escapeHtml(item.commitment.slice(0, 12))}…</code></span></div></div></article>`;
}

function renderEvidenceTimeline() {
  const items = state.current?.evidence || [];
  byId("evidenceTimeline").innerHTML = items.length
    ? items.map(evidenceTimelineItem).join("")
    : `<div class="empty-state">${escapeHtml(tr("Ingen dokumentasjon er registrert i tidslinjen ennå."))}</div>`;
  byId("addEvidenceButton").hidden = !canRegisterEvidence();
}

function renderAssignmentBrief() {
  const item = state.current.assignment;
  const values = [
    ["Kjent omfang", item.known_scope || "Ikke angitt", false],
    ["Kjente begrensninger", item.known_constraints || "Ikke angitt", false],
  ];
  byId("assignmentBrief").innerHTML = values.map(([label, value, wide]) => `<div class="brief-item${wide ? " wide" : ""}"><span>${escapeHtml(label)}</span><strong translate="no">${escapeHtml(value)}</strong></div>`).join("");
}

function renderAcceptance() {
  const roles = new Set(state.current.user_roles || []);
  const assignment = state.current.assignment;
  const container = byId("acceptanceActions");
  if (assignment.is_available) {
    container.innerHTML = "";
    return;
  }
  if (!roles.has("assigned_worker") || !["published", "accepted"].includes(assignment.status)) {
    container.innerHTML = "";
    return;
  }
  if (assignment.status === "accepted") {
    container.innerHTML = '<span class="save-label">Oppdraget er akseptert.</span>';
    return;
  }
  container.innerHTML = '<button class="secondary" type="button" data-assignment-action="request_clarification">Be om avklaring</button><button class="secondary" type="button" data-assignment-action="decline">Avslå</button><button class="primary" type="button" data-assignment-action="accept">Aksepter oppdrag</button>';
}

function renderAssistantPanel() {
  if (!state.current) return;
  const worker = state.current.user_roles.includes("assigned_worker");
  const assignment = state.current.assignment;
  let title = "Følg opp oppdragets neste beslutning";
  let text = "Dokumentasjonshjelperen bruker oppdragsstatus og kildegrunnlag uten å sende innhold til en ekstern KI-tjeneste.";
  let progress = 0;
  let label = statusLabel(assignment.status);
  if (worker) {
    const planning = planningFromForm();
    const required = ["work_description", "work_method", "risk_controls", "tests_and_evidence", "open_questions"];
    const missing = required.filter((field) => !String(planning[field] || "").trim());
    const unknown = [
      !planning.building_type ? tr("byggtype") : "",
      planning.construction_site === "unknown" ? tr("byggeplass") : "",
      planning.energized_proximity === "unknown" ? tr("arbeid nær elektrisk anlegg") : "",
    ].filter(Boolean);
    progress = Math.round(((required.length - missing.length) / required.length) * 100);
    label = isEnglish() ? `${required.length - missing.length} of ${required.length} main fields` : `${required.length - missing.length} av ${required.length} hovedfelt`;
    if (missing.length) {
      title = `${isEnglish() ? "Describe" : "Beskriv"} ${planningFieldLabel(missing[0])}`;
      text = unknown.length
        ? isEnglish()
          ? `Also clarify ${unknown.join(", ")} so the correct sources and requirements are shown.`
          : `Avklar også ${unknown.join(", ")} slik at riktige kilder og krav vises.`
        : tr("Dette er neste manglende del før en planversjon kan sendes inn.");
    } else if (assignment.status !== "accepted_plan") {
      title = "Planen er klar for versjonering";
      text = "Kontroller de viste kildehensynene og send inn en frosset versjon til vurdering.";
    } else {
      title = "Planen er godkjent";
      text = "Oppdragsgiver kan nå utstede en dokumentasjonspakke når arbeidet og kontrollresultatene er klare.";
    }
  } else if (assignment.status === "submitted") {
    title = "En plan venter på vurdering";
    text = "Vurder den innsendte versjonen. Den private arbeidskopien er fortsatt skjult.";
    progress = 75;
  } else if (assignment.status === "accepted_plan") {
    title = "Klargjør dokumentasjon og overlevering";
    text = "Registrer faktisk utført arbeid, prøving og mottaker før dokumentpakken utstedes.";
    progress = 100;
  }
  byId("assistantPanel").innerHTML = `<div class="assistant-progress"><strong>${progress}%</strong><span>${escapeHtml(label)}</span></div><div><span class="eyebrow">Dokumentasjonshjelper</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div><span class="privacy-label">Lokal regelmotor</span>`;
}

function renderConsiderations() {
  if (!state.current) return;
  const items = state.current.considerations || [];
  byId("considerationVersion").textContent = `Kildepakke ${state.current.policy?.version || "-"}`;
  byId("considerationList").innerHTML = items.length ? items.map((item) => `<article class="consideration ${escapeHtml(item.source_class)}"><div class="consideration-header"><div><h3>${escapeHtml(item.title)}</h3><span>${escapeHtml(item.publisher)} · ${escapeHtml(item.reference)}</span></div><span class="source-class">${escapeHtml(sourceClassLabel(item.source_class))}</span></div><div class="consideration-grid"><div><span>Hvorfor vist</span><strong>${escapeHtml(item.trigger)}</strong></div><div><span>Ansvarlig aktør</span><strong>${escapeHtml(item.responsible_actor)}</strong></div><div><span>Planleggingshensyn</span><strong>${escapeHtml(item.consideration)}</strong></div><div><span>Forventet grunnlag</span><strong>${escapeHtml(item.expected_evidence)}</strong></div></div><div class="consideration-footer"><span>${escapeHtml(item.uncertainty)}</span>${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Åpne kilde</a>` : ""}</div></article>`).join("") : '<div class="empty-state">Ingen kildehensyn er beregnet ennå.</div>';
}

function submissionCard(item) {
  const planning = item.snapshot?.planning || {};
  const reviewButton = canReviewCurrent() && item.status === "submitted" ? `<button class="secondary" type="button" data-review-submission="${escapeHtml(item.id)}">Vurder versjon</button>` : "";
  const fields = [["Arbeidsomfang", planning.work_description], ["Arbeidsmetode", planning.work_method], ["Risikotiltak", planning.risk_controls], ["Prøving og dokumentasjon", planning.tests_and_evidence], ["Åpne spørsmål", planning.open_questions]];
  const reviews = (item.reviews || []).map((review) => `<div class="review-entry"><strong><span>${escapeHtml(review.decision === "accepted" ? "Godkjent" : "Returnert")}</span> · <span translate="no">${escapeHtml(review.reviewer_name)}</span></strong><p translate="no">${escapeHtml(review.summary)}</p>${review.findings?.length ? `<ul translate="no">${review.findings.map((finding) => `<li>${escapeHtml(finding)}</li>`).join("")}</ul>` : ""}</div>`).join("");
  return `<article class="submission"><div class="submission-header"><div><strong>Versjon ${item.version}</strong><span><span translate="no">${escapeHtml(item.submitted_by_name)}</span> · ${escapeHtml(formatDate(item.submitted_at))}</span></div><span class="status-badge ${escapeHtml(item.status)}">${escapeHtml(item.status === "accepted" ? "Godkjent" : item.status === "returned" ? "Returnert" : "Innsendt")}</span>${reviewButton}</div><div class="submission-body"><div class="submission-fields">${fields.map(([label, value]) => `<div class="submission-field"><span>${escapeHtml(label)}</span><strong translate="no">${escapeHtml(value || tr("Ikke angitt"))}</strong></div>`).join("")}</div>${reviews ? `<div class="review-history">${reviews}</div>` : ""}</div></article>`;
}

function renderSubmissions() {
  const items = state.current?.submissions || [];
  byId("submissionList").innerHTML = items.length ? items.map(submissionCard).join("") : '<div class="empty-state">Ingen planversjon er sendt inn.</div>';
  const canSubmit = state.current?.user_roles?.includes("assigned_worker") && ["accepted", "in_planning", "returned"].includes(state.current.assignment.status);
  byId("submissionActions").innerHTML = canSubmit ? '<button class="primary" id="submitPlanButton" type="button">Send inn ny versjon</button>' : "";
}

function completionSubmissionCard(item) {
  const completion = item.snapshot?.completion || {};
  const reviewButton = canReviewCurrent() && item.status === "submitted" ? `<button class="secondary" type="button" data-review-completion="${escapeHtml(item.id)}">Vurder utførelse</button>` : "";
  const fields = [
    ["Utført arbeid", completion.work_performed],
    ["Sikker avslutning", completion.safe_closure],
    ["Prøving og kontrollresultater", completion.tests_and_results],
    ["Avvik eller gjenstående arbeid", completion.deviations],
    ["Dokumentasjon og vedlegg", completion.evidence_references],
    ["Merknad til overlevering", completion.handover_notes],
  ];
  const reviews = (item.reviews || []).map((review) => `<div class="review-entry"><strong><span>${escapeHtml(review.decision === "accepted" ? tr("Godkjent") : tr("Returnert"))}</span> · <span translate="no">${escapeHtml(review.reviewer_name)}</span></strong><p translate="no">${escapeHtml(review.summary)}</p>${review.findings?.length ? `<ul translate="no">${review.findings.map((finding) => `<li>${escapeHtml(finding)}</li>`).join("")}</ul>` : ""}</div>`).join("");
  const status = item.status === "accepted" ? tr("Godkjent") : item.status === "returned" ? tr("Returnert") : tr("Innsendt");
  return `<article class="submission completion-submission"><div class="submission-header"><div><strong>${escapeHtml(tr("Utførelsesversjon"))} ${item.version}</strong><span><span translate="no">${escapeHtml(item.submitted_by_name)}</span> · ${escapeHtml(formatDate(item.submitted_at))}</span></div><span class="status-badge ${escapeHtml(item.status)}">${escapeHtml(status)}</span>${reviewButton}</div><div class="submission-body"><div class="submission-fields">${fields.map(([label, value]) => `<div class="submission-field"><span>${escapeHtml(tr(label))}</span><strong translate="no">${escapeHtml(value || tr("Ikke angitt"))}</strong></div>`).join("")}</div>${reviews ? `<div class="review-history">${reviews}</div>` : ""}</div></article>`;
}

function renderCompletion() {
  const assignment = state.current.assignment;
  const worker = state.current.user_roles.includes("assigned_worker");
  const planApproved = ["accepted_plan", "in_execution", "completion_submitted", "completion_returned", "completed", "closed"].includes(assignment.status);
  const editable = worker && ["accepted_plan", "in_execution", "completion_returned"].includes(assignment.status);
  const panel = byId("executionFormPanel");
  panel.hidden = !worker || !planApproved;
  if (worker && planApproved) {
    const local = JSON.parse(localStorage.getItem(completionLocalDraftKey()) || "null");
    fillCompletionForm(local?.data || state.current.completion_draft || {});
    byId("completionForm").querySelectorAll("input, textarea, select").forEach((field) => { field.disabled = !editable; });
    byId("saveCompletionButton").hidden = !editable;
    byId("completionSaveState").textContent = local
      ? tr("Lokale endringer venter")
      : state.current.completion_draft_updated_at
        ? `${tr("Synkronisert")} ${new Date(state.current.completion_draft_updated_at).toLocaleTimeString(activeLocale(), { hour: "2-digit", minute: "2-digit" })}`
        : editable ? tr("Ikke startet") : tr("Låst for vurdering");
  } else {
    byId("completionSaveState").textContent = planApproved ? tr("Vurdering") : tr("Venter på godkjent plan");
  }
  const items = state.current.completion_submissions || [];
  byId("completionSubmissionList").innerHTML = items.length ? items.map(completionSubmissionCard).join("") : `<div class="empty-state">${escapeHtml(tr("Ingen utførelsesregistrering er sendt inn."))}</div>`;
  byId("completionActions").innerHTML = editable ? `<button class="primary" id="submitCompletionButton" type="button">${escapeHtml(tr("Send utførelse til vurdering"))}</button>` : "";
}

function renderAssignmentDocuments() {
  const assignment = state.current.assignment;
  const packages = state.current.document_packages || [];
  const accepted = ["accepted_plan", "in_execution", "completion_submitted", "completion_returned", "completed", "closed"].includes(assignment.status) || packages.length > 0;
  const completionAccepted = ["completed", "closed"].includes(assignment.status) || packages.length > 0;
  const receiptReady = packages.some((item) => item.status === "issued");
  const midnightReady = packages.some((item) => item.midnight_status === "confirmed");
  const canIssue = completionAccepted && (assignment.provider_id === state.user.id || canProvide());
  byId("documentReadiness").innerHTML = `
    <div class="readiness-step ${accepted ? "ready" : "waiting"}"><span>1</span><div><strong>Godkjent grunnlag</strong><p>${accepted ? "Godkjent planversjon er tilgjengelig." : "Venter på faglig vurdering av planversjonen."}</p></div></div>
    <div class="readiness-step ${completionAccepted ? "ready" : "waiting"}"><span>2</span><div><strong>Godkjent sluttkontroll</strong><p>${completionAccepted ? "Utførelse og kontrollresultater er godkjent." : "Venter på innsendt og vurdert utførelsesregistrering."}</p></div></div>
    <div class="readiness-step ${receiptReady ? "ready" : "waiting"}"><span>3</span><div><strong>Utstedt dokumentpakke</strong><p>${receiptReady ? "Innhold og kvittering er fryst i en sporbar versjon." : "Dokumentpakken er ikke utstedt ennå."}</p></div></div>
    <div class="readiness-step ${midnightReady ? "ready" : "optional"}"><span>4</span><div><strong class="midnight-heading">${midnightMark()}<span>Midnight-forankring</span></strong><p>${midnightReady ? "Forankringen kan kontrolleres uavhengig." : "Valgfri pilot. Ingen forankring hevdes ennå."}</p></div></div>`;
  byId("assignmentDocumentList").innerHTML = packages.length ? packages.map(documentPackageCard).join("") : '<div class="empty-state">Ingen dokumentasjonspakke er utstedt for oppdraget.</div>';
  byId("documentActions").innerHTML = canIssue ? '<button class="primary" id="issueDocumentButton" type="button">Utsted dokumentasjonspakke</button>' : "";
}

function renderAssignment() {
  const item = state.current.assignment;
  byId("assignmentTitle").textContent = item.title;
  byId("assignmentPurpose").textContent = item.purpose;
  const locationLink = byId("assignmentLocationLink");
  byId("assignmentLocation").textContent = item.location_context || tr("Kunde eller anlegg ikke oppgitt");
  locationLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location_context || "")}`;
  locationLink.hidden = !item.location_context;
  const status = byId("assignmentStatus");
  status.hidden = item.is_available;
  status.textContent = statusLabel(item.status);
  status.className = `status-badge ${item.status}`;
  const artifactsExist = Boolean(
    state.current.draft_updated_at
    || state.current.completion_draft_updated_at
    || state.current.submissions?.length
    || state.current.completion_submissions?.length
    || state.current.evidence?.length
    || state.current.document_packages?.length
  );
  const canEdit = canProvide() && item.status === "published" && !artifactsExist;
  const primaryAction = item.is_available
    ? canProvide()
      ? `<button class="primary compact-button" type="button" data-assign-later>${escapeHtml(tr("Tildel"))}</button>`
      : activeRoles().has("worker")
        ? `<button class="primary compact-button" type="button" data-claim-assignment>${escapeHtml(tr("Ta oppdrag"))}</button>`
        : ""
    : "";
  const duplicateAction = canProvide() ? `<button class="secondary compact-button" type="button" data-duplicate-assignment>${escapeHtml(tr("Kopier"))}</button>` : "";
  byId("assignmentHeadingActions").innerHTML = `${primaryAction}${duplicateAction}${canEdit ? `<button class="secondary compact-button" type="button" data-edit-assignment>${escapeHtml(tr("Rediger"))}</button><button class="secondary compact-button danger-text" type="button" data-delete-assignment>${escapeHtml(tr("Slett"))}</button>` : ""}`;
  renderAssignmentSummary();
  renderAssignmentBrief();
  renderAcceptance();
  const worker = state.current.user_roles.includes("assigned_worker");
  if (worker) {
    const local = JSON.parse(localStorage.getItem(localDraftKey()) || "null");
    fillPlanningForm(local?.data || state.current.draft || {});
    byId("draftSaveState").textContent = local ? tr("Lokale endringer venter") : state.current.draft_updated_at ? `${tr("Synkronisert")} ${new Date(state.current.draft_updated_at).toLocaleTimeString(activeLocale(), { hour: "2-digit", minute: "2-digit" })}` : tr("Ikke lagret");
  }
  renderAssistantPanel();
  renderConsiderations();
  renderSubmissions();
  renderEvidenceTimeline();
  renderCompletion();
  renderAssignmentDocuments();
  const recommendedStep = recommendedAssignmentStep();
  const rememberedStep = Number(localStorage.getItem(assignmentStepStorageKey()) || 1);
  state.assignmentMaxStep = Math.max(recommendedStep, Math.min(5, rememberedStep));
  state.assignmentStep = recommendedStep;
  renderAssignmentStepper();
  showView("assignment");
}

async function openAssignment(id) {
  try {
    state.current = await api(`/api/assignments/${encodeURIComponent(id)}`);
    renderSidebarAssignments();
    renderAssignment();
  } catch (error) {
    notify(error.message, true);
  }
}

async function assignmentAction(action) {
  try {
    await api(`/api/assignments/${encodeURIComponent(state.current.assignment.id)}/action`, { method: "POST", body: { action } });
    notify(action === "accept" ? "Oppdraget er akseptert." : action === "decline" ? "Oppdraget er avslått." : "Behov for avklaring er registrert.");
    await loadBootstrap();
    await openAssignment(state.current.assignment.id);
  } catch (error) {
    notify(error.message, true);
  }
}

async function claimAssignment() {
  const assignmentId = state.current.assignment.id;
  try {
    await api(`/api/assignments/${encodeURIComponent(assignmentId)}/claim`, { method: "POST", body: {} });
    notify(tr("Oppdraget er nå tildelt deg."));
    await loadBootstrap();
    await openAssignment(assignmentId);
  } catch (error) {
    notify(error.message, true);
    await loadBootstrap();
  }
}

async function openLateAssignmentDialog() {
  if (!state.current?.assignment || !canProvide()) return;
  if (["closed", "completed", "cancelled", "declined"].includes(state.current.assignment.status)) return;
  await loadMembers();
  byId("lateAssignmentForm").dataset.assignmentId = state.current.assignment.id;
  renderAssignmentTeamOptions(state.current.assignment);
  byId("lateAssignmentDialog").showModal();
}

function activeWorkerMembers() {
  return (state.members || []).filter((member) => member.status === "active" && (member.roles || []).includes("worker"));
}

function selectedTeamEmails() {
  return [...document.querySelectorAll('input[name="assignmentTeamMember"]:checked')].map((input) => input.value);
}

function syncProfessionalResponsibleOptions(preferred = "") {
  const selected = new Set(selectedTeamEmails());
  const workers = activeWorkerMembers().filter((member) => selected.has(member.email));
  const input = byId("professionalResponsibleInput");
  const current = preferred || input.value;
  input.innerHTML = `<option value="">${escapeHtml(tr(workers.length ? "Velg AFA" : "Ingen teknikere i arbeidslaget"))}</option>${workers.map((member) => `<option value="${escapeHtml(member.email)}">${escapeHtml(member.display_name || member.email)}</option>`).join("")}`;
  input.value = workers.some((member) => member.email === current) ? current : "";
  input.required = workers.length > 0;
  input.disabled = workers.length === 0;
}

function renderAssignmentTeamOptions(assignment) {
  const currentWorkers = new Set((assignment.assigned_workers || (assignment.assigned_worker ? [assignment.assigned_worker] : [])).map((worker) => worker.email));
  const workers = activeWorkerMembers();
  byId("assignmentTeamOptions").innerHTML = workers.length
    ? workers.map((member) => `<label class="team-option"><input type="checkbox" name="assignmentTeamMember" value="${escapeHtml(member.email)}"${currentWorkers.has(member.email) ? " checked" : ""} /><span><strong translate="no">${escapeHtml(member.display_name || member.email)}</strong><small>${escapeHtml(member.profile?.role_title || member.email)}</small></span></label>`).join("")
    : `<div class="empty-state">${escapeHtml(tr("Ingen aktive teknikere i organisasjonen."))}</div>`;
  syncProfessionalResponsibleOptions(assignment.professional_responsible_user?.email || "");
}

async function assignAvailableAssignment(event) {
  event.preventDefault();
  const assignmentId = byId("lateAssignmentForm").dataset.assignmentId;
  const workerEmails = selectedTeamEmails();
  const responsibleEmail = byId("professionalResponsibleInput").value;
  if (workerEmails.length && !responsibleEmail) {
    notify(tr("Velg én AFA fra arbeidslaget."), true);
    return;
  }
  try {
    await api(`/api/assignments/${encodeURIComponent(assignmentId)}/team`, {
      method: "PUT",
      body: { worker_emails: workerEmails, professional_responsible_email: responsibleEmail },
    });
    byId("lateAssignmentDialog").close();
    notify(tr("Arbeidslaget er oppdatert."));
    await loadBootstrap();
    await openAssignment(assignmentId);
  } catch (error) {
    notify(error.message, true);
  }
}

async function submitPlan() {
  await saveDraft(false);
  if (!navigator.onLine) {
    notify("Koble til før en versjon sendes inn.", true);
    return;
  }
  try {
    const result = await api(`/api/assignments/${encodeURIComponent(state.current.assignment.id)}/submit`, { method: "POST", body: {} });
    notify(isEnglish() ? `Plan version ${result.version} has been submitted.` : `Planversjon ${result.version} er sendt inn.`);
    await loadBootstrap();
    await openAssignment(state.current.assignment.id);
  } catch (error) {
    if (error.data?.missing) notify(isEnglish() ? `Missing before submission: ${error.data.missing.map(planningFieldLabel).join(", ")}` : `Mangler før innsending: ${error.data.missing.map(planningFieldLabel).join(", ")}`, true);
    else notify(error.message, true);
  }
}

async function submitCompletion() {
  await saveCompletion(false);
  if (!navigator.onLine) {
    notify("Koble til før utførelsesregistreringen sendes inn.", true);
    return;
  }
  try {
    const result = await api(`/api/assignments/${encodeURIComponent(state.current.assignment.id)}/completion-submit`, { method: "POST", body: {} });
    notify(isEnglish() ? `Completion version ${result.version} has been submitted.` : `Utførelsesversjon ${result.version} er sendt inn.`);
    await loadBootstrap();
    await openAssignment(state.current.assignment.id);
  } catch (error) {
    if (error.data?.missing) notify(isEnglish() ? `Missing before submission: ${error.data.missing.map(completionFieldLabel).join(", ")}` : `Mangler før innsending: ${error.data.missing.map(completionFieldLabel).join(", ")}`, true);
    else notify(error.message, true);
  }
}

function openReview(submissionId) {
  const item = state.current.submissions.find((submission) => submission.id === submissionId);
  if (!item) return;
  byId("reviewForm").dataset.submissionId = submissionId;
  byId("reviewDialogTitle").textContent = isEnglish() ? `Review version ${item.version}` : `Vurder versjon ${item.version}`;
  byId("reviewDecision").value = "returned";
  byId("reviewSummary").value = "";
  byId("reviewFindings").value = "";
  byId("reviewDialog").showModal();
}

function openCompletionReview(completionSubmissionId) {
  const item = (state.current.completion_submissions || []).find((submission) => submission.id === completionSubmissionId);
  if (!item) return;
  byId("completionReviewForm").dataset.completionSubmissionId = completionSubmissionId;
  byId("completionReviewDialogTitle").textContent = isEnglish() ? `Review completion version ${item.version}` : `Vurder utførelsesversjon ${item.version}`;
  byId("completionReviewDecision").value = "returned";
  byId("completionReviewSummary").value = "";
  byId("completionReviewFindings").value = "";
  byId("completionReviewDialog").showModal();
}

function openEvidenceDialog() {
  if (!state.current || !canRegisterEvidence()) return;
  const status = state.current.assignment.status;
  byId("evidenceForm").reset();
  byId("evidencePhaseInput").value = ["completed", "closed"].includes(status)
    ? "after"
    : status === "in_execution" ? "during" : "before";
  byId("evidenceDialog").showModal();
}

async function registerEvidence(event) {
  event.preventDefault();
  if (!state.current) return;
  const assignmentId = state.current.assignment.id;
  const body = new FormData();
  body.append("phase", byId("evidencePhaseInput").value);
  body.append("evidence_type", byId("evidenceTypeInput").value);
  body.append("title", byId("evidenceTitleInput").value);
  body.append("note", byId("evidenceNoteInput").value);
  const file = byId("evidenceFileInput").files[0];
  if (file) body.append("file", file);
  try {
    await api(`/api/assignments/${encodeURIComponent(assignmentId)}/evidence`, { method: "POST", body });
    byId("evidenceDialog").close();
    notify("Dokumentasjonen er registrert med tidspunkt og filhash.");
    await openAssignment(assignmentId);
  } catch (error) {
    notify(error.message, true);
  }
}

function openDocumentPackageDialog() {
  if (!state.current) return;
  byId("documentTitleInput").value = `${isEnglish() ? "Documentation" : "Dokumentasjon"} - ${state.current.assignment.title}`;
  byId("propertyReferenceInput").value = state.current.assignment.location_context || "";
  byId("ownerEmailInput").value = "";
  byId("ownerPurposeInput").value = tr("Varig dokumentasjon for eier av anlegget");
  byId("documentPackageDialog").showModal();
}

async function issueDocumentPackage(event) {
  event.preventDefault();
  if (!state.current) return;
  const assignmentId = state.current.assignment.id;
  const body = {
    title: byId("documentTitleInput").value,
    property_reference: byId("propertyReferenceInput").value,
    owner_email: byId("ownerEmailInput").value,
    purpose: byId("ownerPurposeInput").value,
  };
  try {
    await api(`/api/assignments/${encodeURIComponent(assignmentId)}/document-packages`, { method: "POST", body });
    byId("documentPackageDialog").close();
    notify("Dokumentasjonspakken er utstedt og eiertilgang er registrert.");
    await loadBootstrap();
    await openAssignment(assignmentId);
  } catch (error) {
    notify(error.message, true);
  }
}

function packageById(packageId) {
  return (state.current?.document_packages || []).find((item) => item.id === packageId)
    || (state.document_packages || []).find((item) => item.id === packageId);
}

function openDocumentDetail(packageId) {
  const item = packageById(packageId);
  if (!item || item.content_status !== "available") return;
  const report = item.report || {};
  const planning = report.planning || {};
  const planFields = [
    ["Arbeidsomfang", planning.work_description],
    ["Arbeidsmetode", planning.work_method],
    ["Risikotiltak", planning.risk_controls],
    ["Prøving som var planlagt", planning.tests_and_evidence],
    ["Åpne spørsmål i godkjent plan", planning.open_questions],
  ].filter(([, value]) => String(value || "").trim());
  const reviews = (report.reviews || []).map((review) => `<div class="document-review"><strong><span>${escapeHtml(review.decision === "accepted" ? "Godkjent grunnlag" : "Vurdering")}</span> · <span translate="no">${escapeHtml(review.reviewer_name || tr("Vurderer"))}</span></strong><p translate="no">${escapeHtml(review.summary || "")}</p>${review.findings?.length ? `<ul translate="no">${review.findings.map((finding) => `<li>${escapeHtml(finding)}</li>`).join("")}</ul>` : ""}</div>`).join("");
  const completionReviews = (report.completion_reviews || []).map((review) => `<div class="document-review"><strong><span>${escapeHtml(review.decision === "accepted" ? tr("Godkjent utførelse") : tr("Vurdering"))}</span> · <span translate="no">${escapeHtml(review.reviewer_name || tr("Vurderer"))}</span></strong><p translate="no">${escapeHtml(review.summary || "")}</p>${review.findings?.length ? `<ul translate="no">${review.findings.map((finding) => `<li>${escapeHtml(finding)}</li>`).join("")}</ul>` : ""}</div>`).join("");
  const evidenceTimeline = report.evidence_timeline || [];
  byId("documentDetailTitle").textContent = item.title;
  byId("documentDetailContent").innerHTML = `
    ${item.is_demonstration ? '<div class="document-demo detail-demo"><strong>Syntetisk demonstrasjon</strong><span>Hele rapporten, inkludert måleverdier og mottaker, er oppdiktet og skal ikke brukes som anleggsdokumentasjon.</span></div>' : ""}
    <div class="document-detail-header"><div><span>Anlegg eller sted</span><strong translate="no">${escapeHtml(item.property_reference)}</strong></div><div><span>Utstedt av</span><strong><span translate="no">${escapeHtml(item.issued_by_name)}</span> · ${escapeHtml(formatDate(item.issued_at))}</strong></div><div><span>Versjon</span><strong>${escapeHtml(String(item.version))}</strong></div></div>
    <section><h3>Utført arbeid og resultat</h3><p translate="no">${escapeHtml(item.summary)}</p></section>
    <div class="document-detail-grid"><section><h3>Sikker avslutning</h3><p translate="no">${escapeHtml(report.safe_closure || tr("Ikke registrert"))}</p></section><section><h3>Prøving, målinger og kontroll</h3><p translate="no">${escapeHtml(report.tests_and_results || tr("Ikke registrert"))}</p></section><section><h3>Avvik og begrensninger</h3><p translate="no">${escapeHtml(report.deviations || tr("Ingen registrerte"))}</p></section><section><h3>Dokumentasjon og vedlegg</h3><p translate="no">${escapeHtml(report.evidence_references || tr("Ikke registrert"))}</p></section><section><h3>Overlevering</h3><p translate="no">${escapeHtml(report.handover_notes || tr("Ingen særskilt merknad"))}</p></section><section><h3>Dokumentmottaker</h3><p translate="no">${escapeHtml(item.owner_email)}</p></section></div>
    ${planFields.length ? `<section><div class="document-section-heading"><h3>Godkjent planversjon ${escapeHtml(String(report.accepted_plan_version || ""))}</h3><span>Grunnlag, ikke utførelsesattest</span></div><dl class="document-plan-fields">${planFields.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd translate="no">${escapeHtml(value)}</dd></div>`).join("")}</dl></section>` : ""}
    ${reviews ? `<section><h3>Faglig vurdering av planen</h3><div class="document-reviews">${reviews}</div></section>` : ""}
    ${completionReviews ? `<section><h3>${escapeHtml(tr("Vurdering av utførelse og sluttkontroll"))} · ${escapeHtml(tr("versjon"))} ${escapeHtml(String(report.accepted_completion_version || ""))}</h3><div class="document-reviews">${completionReviews}</div></section>` : ""}
    ${evidenceTimeline.length ? `<section><div class="document-section-heading"><h3>${escapeHtml(tr("Dokumentasjonstidslinje"))}</h3><span>${escapeHtml(tr("Tidspunkt og filhash inngår i denne versjonen"))}</span></div><div class="evidence-timeline document-evidence-timeline">${evidenceTimeline.map(evidenceTimelineItem).join("")}</div></section>` : ""}
    <div class="document-receipt-note"><strong>Integritetskvittering</strong><code>${escapeHtml(item.commitment)}</code><p class="midnight-note">${midnightMark()}<span>${escapeHtml(midnightStatusLabel(item.midnight_status))}. Ingen blokkjedeforankring hevdes uten en bekreftet transaksjon.</span></p></div>`;
  byId("documentDetailDialog").showModal();
}

function syncGrantExpiry() {
  const owner = byId("grantTypeInput").value === "owner";
  byId("grantExpiresInput").required = !owner;
  byId("grantExpiresInput").disabled = owner;
  if (owner) byId("grantExpiresInput").value = "";
}

function openDocumentGrant(packageId) {
  const item = packageById(packageId);
  if (!item?.can_manage) return;
  byId("documentGrantForm").dataset.packageId = packageId;
  byId("grantEmailInput").value = "";
  byId("grantTypeInput").value = "contractor";
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  byId("grantExpiresInput").value = expiry.toISOString().slice(0, 10);
  byId("grantPurposeInput").value = "";
  syncGrantExpiry();
  byId("documentGrantDialog").showModal();
}

async function grantDocumentAccess(event) {
  event.preventDefault();
  const packageId = byId("documentGrantForm").dataset.packageId;
  const body = {
    recipient_email: byId("grantEmailInput").value,
    grant_type: byId("grantTypeInput").value,
    expires_at: byId("grantExpiresInput").value,
    purpose: byId("grantPurposeInput").value,
  };
  try {
    await api(`/api/document-packages/${encodeURIComponent(packageId)}/grants`, { method: "POST", body });
    byId("documentGrantDialog").close();
    notify("Tilgangen er registrert med mottaker og formål.");
    const assignmentId = state.current?.assignment?.id || "";
    await loadBootstrap();
    if (assignmentId) await openAssignment(assignmentId);
  } catch (error) {
    notify(error.message, true);
  }
}

async function revokeDocumentAccess(packageId, grantId) {
  if (!window.confirm(tr("Vil du trekke denne mottakerens tilgang til dokumentpakken?"))) return;
  try {
    await api(`/api/document-packages/${encodeURIComponent(packageId)}/grants/${encodeURIComponent(grantId)}/revoke`, { method: "POST", body: {} });
    notify("Tilgangen er trukket tilbake.");
    const assignmentId = state.current?.assignment?.id || "";
    await loadBootstrap();
    if (assignmentId) await openAssignment(assignmentId);
  } catch (error) {
    notify(error.message, true);
  }
}

async function verifyDocumentPackage(packageId) {
  try {
    const result = await api(`/api/document-packages/${encodeURIComponent(packageId)}/verify`);
    const valid = result.integrity?.valid;
    const transaction = result.midnight?.transaction;
    const transactionFact = transaction?.id ? `<div><dt>Midnight-transaksjon</dt><dd><code>${escapeHtml(transaction.id)}</code></dd></div>` : "";
    const blockFact = transaction?.block_height != null ? `<div><dt>Bekreftet i blokk</dt><dd>${escapeHtml(String(transaction.block_height))}</dd></div>` : "";
    byId("verificationResult").innerHTML = `<div class="verification-state ${valid ? "valid" : "invalid"}"><strong>${valid ? "Dokumentkvitteringen er gyldig" : "Dokumentkvitteringen kan ikke bekreftes"}</strong><p>${valid ? "Den registrerte pakken er uendret siden den ble utstedt." : "Innhold eller signatur samsvarer ikke med den utstedte pakken."}</p></div><dl class="verification-facts"><div><dt>Status</dt><dd>${escapeHtml(packageStatusLabel(result.status))}</dd></div><div><dt>Utstedt</dt><dd>${escapeHtml(formatDate(result.issued_at))}</dd></div><div class="midnight-verification"><dt>${midnightMark()}</dt><dd>${escapeHtml(midnightStatusLabel(result.midnight?.status))}</dd></div><div><dt>Forpliktelse</dt><dd><code>${escapeHtml(result.commitment)}</code></dd></div>${transactionFact}${blockFact}</dl><p class="verification-note">${escapeHtml(tr(result.midnight?.statement || ""))}</p>`;
    byId("verificationDialog").showModal();
  } catch (error) {
    notify(error.message, true);
  }
}

function renderDemoShareDialog() {
  const item = demoPackageForArchive();
  if (!item) return;
  const transaction = item.midnight?.transaction || {};
  const recipients = item.demo_recipients.map((recipient) => {
    const status = recipient.active
      ? tr("Aktiv tilgang")
      : recipient.status === "expired"
        ? tr("Utløpt")
        : recipient.status === "revoked"
          ? tr("Trukket tilbake")
          : tr("Ikke delt");
    const action = recipient.active ? "revoke" : "grant";
    const actionLabel = recipient.active ? tr("Trekk demotilgang") : tr("Gi demotilgang");
    const preview = recipient.active ? `<button class="secondary compact-button" type="button" data-demo-recipient-view="${escapeHtml(recipient.key)}">${escapeHtml(tr("Se mottakervisning"))}</button>` : "";
    return `<li class="demo-recipient-row"><div><strong>${escapeHtml(demoRecipientLabel(recipient.key))}</strong><p>${escapeHtml(demoRecipientPurpose(recipient.key))}</p></div><div class="demo-recipient-state"><span class="${recipient.active ? "active" : ""}">${escapeHtml(status)}</span><small>${escapeHtml(demoDurationLabel(recipient.duration_kind, recipient.expires_at))}</small></div><div class="demo-recipient-actions">${preview}<button class="${recipient.active ? "secondary" : "primary"} compact-button" type="button" data-demo-access-key="${escapeHtml(recipient.key)}" data-demo-access-action="${action}">${escapeHtml(actionLabel)}</button></div></li>`;
  }).join("");
  byId("demoShareReportLink").href = demoReportPath();
  byId("demoShareContent").innerHTML = `
    <div class="document-demo detail-demo"><strong>${escapeHtml(tr("Trygg demonstrasjon"))}</strong><span>${escapeHtml(tr("Tilgangene gjelder bare din egen syntetiske økt. Ingen e-post sendes, og ingen virkelig mottaker opprettes."))}</span></div>
    <div class="demo-proof-flow"><section><span>01 · FieldSeal</span><h3>${escapeHtml(tr("Styrer hvem som kan lese"))}</h3><p>${escapeHtml(tr("Mottaker, formål og varighet kan gis og trekkes tilbake uten å endre rapporten."))}</p></section><section><span>02 · Midnight</span><h3>${escapeHtml(tr("Bekrefter samme rapportversjon"))}</h3><p>${escapeHtml(tr("Bare dokumentforpliktelsen er forankret. Rapportinnhold og personopplysninger forblir private i FieldSeal."))}</p></section></div>
    <ul class="demo-recipient-list">${recipients}</ul>
    <dl class="demo-anchor-facts"><div><dt>${escapeHtml(tr("Rapport"))}</dt><dd><code>${escapeHtml(item.job_reference)}</code></dd></div><div><dt>${midnightMark()}</dt><dd>${escapeHtml(midnightStatusLabel(item.midnight_status))}</dd></div><div><dt>${escapeHtml(tr("Transaksjon"))}</dt><dd><code>${escapeHtml(transaction.id || tr("Ikke tilgjengelig"))}</code></dd></div><div><dt>${escapeHtml(tr("Blokk"))}</dt><dd>${escapeHtml(transaction.block_height == null ? tr("Ikke tilgjengelig") : String(transaction.block_height))}</dd></div></dl>
    <p class="demo-anchor-note">${escapeHtml(tr("Når en demotilgang endres, er Midnight-forankringen uendret. Den bekrefter fortsatt nøyaktig den utstedte rapportversjonen."))}</p>`;
}

function openDemoRecipientView(recipientKey) {
  const item = demoPackageForArchive();
  const recipient = item?.demo_recipients.find((candidate) => candidate.key === recipientKey);
  if (!item || !recipient?.active) {
    notify(tr("Gi rollen demotilgang før mottakervisningen åpnes."), true);
    return;
  }
  const role = demoRecipientLabel(recipient.key);
  byId("demoRecipientTitle").textContent = role;
  byId("demoRecipientReportLink").href = demoReportPath();
  byId("demoRecipientContent").innerHTML = `
    <div class="recipient-access-state"><span>${escapeHtml(tr("Tilgang aktiv"))}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(demoRecipientPurpose(recipient.key))}</p></div>
    <div class="recipient-entry-flow" aria-label="${escapeHtml(tr("Slik får mottakeren tilgang"))}"><section><span>01</span><div><strong>${escapeHtml(tr("Motta invitasjon"))}</strong><p>${escapeHtml(tr("FieldSeal gir en sikker lenke som kan deles med den registrerte e-postadressen."))}</p></div></section><section><span>02</span><div><strong>${escapeHtml(tr("Bekreft identitet"))}</strong><p>${escapeHtml(tr("Mottakeren logger inn med samme adresse som tilgangen ble gitt til."))}</p></div></section><spa
    <dl class="recipient-access-facts"><div><dt>${escapeHtml(tr("Rolle"))}</dt><dd>${escapeHtml(role)}</dd></div><div><dt>${escapeHtml(tr("Formål"))}</dt><dd>${escapeHtml(demoRecipientPurpose(recipient.key))}</dd></div><div><dt>${escapeHtml(tr("Varighet"))}</dt><dd>${escapeHtml(demoDurationLabel(recipient.duration_kind, recipient.expires_at))}</dd></div><div><dt>${midnightMark()}</dt><dd>${escapeHtml(midnightStatusLabel(item.midnight_status))}</dd></div></dl>
    <div class="recipient-permissions"><section><span aria-hidden="true">✓</span><div><strong>${escapeHtml(tr("Kan lese rapporten"))}</strong><p>${escapeHtml(tr("Mottakeren får innholdet som er uttrykkelig delt for dette formålet."))}</p></div></section><section><span aria-hidden="true">✓</span><div><strong>${escapeHtml(tr("Kan kontrollere rapportversjonen"))}</strong><p>${escapeHtml(tr("Midnight-forankringen bekrefter at den utstedte rapporten er uendret."))}</p></div></section><section class="restricted"><span aria-hidden="true">–</span><div><strong>${escapeHtml(tr("Kan ikke endre eller videredele"))}</strong><p>${escapeHtml(tr("Mottakeren ser ikke andre oppdrag, medlemmer eller organisasjonsdata."))}</p></div></section></div>
    <p class="recipient-demo-note">${escapeHtml(tr("I denne syntetiske demoen hoppes e-post og ny innlogging over. Tilgangsreglene er de samme som i den virkelige dokumentflyten."))}</p>`;
  byId("demoRecipientDialog").showModal();
}

function openDemoShare() {
  if (!state.demo_documentation) return;
  renderDemoShareDialog();
  byId("demoShareDialog").showModal();
}

async function changeDemoAccess(recipientKey, action) {
  if (action === "revoke" && !window.confirm(tr("Vil du trekke denne syntetiske demotilgangen?"))) return;
  try {
    const suffix = action === "revoke" ? "/revoke" : "";
    const result = await api(`/api/midnight-demo/access/${encodeURIComponent(recipientKey)}${suffix}`, { method: "POST", body: {} });
    state.demo_documentation.access = result;
    renderDocumentation();
    renderDemoShareDialog();
    notify(action === "revoke" ? "Demotilgangen er trukket tilbake." : "Demotilgangen er aktivert.");
  } catch (error) {
    notify(error.message, true);
  }
}

async function verifyDemoPackage() {
  try {
    const result = await api("/api/public/midnight-demo");
    state.demo_documentation = { ...result, access: state.demo_documentation?.access };
    renderDocumentation();
    const valid = result.receipt?.integrity?.valid;
    const transaction = result.midnight?.transaction || {};
    byId("verificationResult").innerHTML = `<div class="verification-state ${valid ? "valid" : "invalid"}"><strong>${escapeHtml(valid ? tr("Dokumentkvitteringen er gyldig") : tr("Dokumentkvitteringen kan ikke bekreftes"))}</strong><p>${escapeHtml(valid ? tr("Den syntetiske rapporten er uendret siden denne versjonen ble utstedt.") : tr("Innhold eller signatur samsvarer ikke med den utstedte pakken."))}</p></div><dl class="verification-facts"><div><dt>${escapeHtml(tr("Status"))}</dt><dd>${escapeHtml(packageStatusLabel(result.receipt?.status))}</dd></div><div><dt>${escapeHtml(tr("Utstedt"))}</dt><dd>${escapeHtml(formatDate(result.receipt?.issued_at))}</dd></div><div class="midnight-verification"><dt>${midnightMark()}</dt><dd>${escapeHtml(midnightStatusLabel(result.midnight?.status))}</dd></div><div><dt>${escapeHtml(tr("Forpliktelse"))}</dt><dd><code>${escapeHtml(result.receipt?.commitment || "")}</code></dd></div><div><dt>${escapeHtml(tr("Midnight-transaksjon"))}</dt><dd><code>${escapeHtml(transaction.id || tr("Ikke tilgjengelig"))}</code></dd></div><div><dt>${escapeHtml(tr("Bekreftet i blokk"))}</dt><dd>${escapeHtml(transaction.block_height == null ? tr("Ikke tilgjengelig") : String(transaction.block_height))}</dd></div></dl><p class="verification-note">${escapeHtml(tr("Midnight bekrefter dokumentforpliktelsen. Rapporten og personopplysningene er ikke publisert på blokkjeden."))}</p>`;
    byId("verificationDialog").showModal();
  } catch (error) {
    notify(error.message, true);
  }
}

async function createOrganization(event) {
  event.preventDefault();
  try {
    await api("/api/organizations", { method: "POST", body: { name: byId("organizationName").value, organization_type: byId("organizationType").value } });
    byId("organizationDialog").close();
    byId("organizationForm").reset();
    notify("Organisasjonen er opprettet.");
    await loadBootstrap();
  } catch (error) { notify(error.message, true); }
}

function openMemberInviteDialog() {
  state.inviteLinkId = "";
  byId("memberForm").reset();
  byId("inviteLinkResult").hidden = true;
  byId("createInviteLinkButton").hidden = false;
  byId("memberDialog").showModal();
}

async function createOrganizationJoinLink(event) {
  event.preventDefault();
  try {
    const result = await api(`/api/organizations/${encodeURIComponent(state.activeOrgId)}/join-links`, { method: "POST", body: { duration_days: 7 } });
    const link = result.join_link;
    state.inviteLinkId = link.id;
    byId("inviteQrImage").src = link.qr_data_url;
    byId("inviteLinkInput").value = link.url;
    byId("inviteLinkExpiry").textContent = `${tr("Gyldig til")} ${formatDateTime(link.expires_at)}`;
    byId("inviteLinkResult").hidden = false;
    byId("createInviteLinkButton").hidden = true;
    notify("Invitasjonslenken er klar.");
  } catch (error) { notify(error.message, true); }
}

async function copyOrganizationJoinLink() {
  const input = byId("inviteLinkInput");
  if (!input.value) return;
  try {
    await navigator.clipboard.writeText(input.value);
  } catch (_error) {
    input.focus();
    input.select();
    document.execCommand("copy");
  }
  notify("Invitasjonslenken er kopiert.");
}

async function revokeOrganizationJoinLink() {
  if (!state.inviteLinkId) return;
  try {
    await api(`/api/organizations/${encodeURIComponent(state.activeOrgId)}/join-links/${encodeURIComponent(state.inviteLinkId)}`, { method: "DELETE" });
    state.inviteLinkId = "";
    byId("inviteLinkResult").hidden = true;
    byId("createInviteLinkButton").hidden = false;
    notify("Invitasjonslenken er trukket tilbake.");
  } catch (error) { notify(error.message, true); }
}

function openMemberRoleDialog(membershipId) {
  if (!activeRoles().has("admin")) return;
  const member = state.members.find((item) => item.id === membershipId);
  if (!member) return;
  const form = byId("memberRoleForm");
  form.dataset.membershipId = membershipId;
  byId("memberRoleDialogTitle").textContent = `${tr("Administrer roller")} · ${member.display_name || member.email}`;
  const roles = new Set(member.roles || []);
  document.querySelectorAll('input[name="managedMemberRole"]').forEach((input) => { input.checked = roles.has(input.value); });
  byId("memberRoleDialog").showModal();
}

async function saveMemberRoles(event) {
  event.preventDefault();
  const membershipId = byId("memberRoleForm").dataset.membershipId;
  const roles = [...document.querySelectorAll('input[name="managedMemberRole"]:checked')].map((input) => input.value);
  try {
    await api(`/api/organizations/${encodeURIComponent(state.activeOrgId)}/members/${encodeURIComponent(membershipId)}`, { method: "PUT", body: { roles } });
    byId("memberRoleDialog").close();
    notify("Rollene er oppdatert.");
    await Promise.all([loadBootstrap(), loadMembers()]);
  } catch (error) { notify(error.message, true); }
}

async function saveAssignment(event) {
  event.preventDefault();
  const assignmentId = byId("assignmentForm").dataset.assignmentId || "";
  const families = [...document.querySelectorAll('input[name="workFamily"]:checked')].map((input) => input.value);
  const customerId = byId("customerInput").value;
  const assignee = byId("assigneesInput").value;
  const body = {
    organization_id: state.activeOrgId,
    title: byId("assignmentTitleInput").value,
    work_families: families,
    purpose: byId("assignmentPurposeInput").value,
    known_scope: byId("knownScopeInput").value,
    known_constraints: byId("knownConstraintsInput").value,
    customer_id: customerId === "__new__" ? "" : customerId,
    new_customer: customerId === "__new__" ? { name: byId("newCustomerNameInput").value, address: byId("newCustomerAddressInput").value } : null,
    assignees: assignmentId ? [] : assignee ? [assignee] : [],
  };
  try {
    const result = await api(assignmentId ? `/api/assignments/${encodeURIComponent(assignmentId)}` : "/api/assignments", { method: assignmentId ? "PUT" : "POST", body });
    byId("assignmentDialog").close();
    byId("assignmentForm").reset();
    byId("assignmentForm").dataset.assignmentId = "";
    document.querySelector('input[name="workFamily"][value="electro"]').checked = true;
    syncNewCustomerFields();
    notify(assignmentId ? tr("Oppdraget er oppdatert.") : tr("Oppdraget er publisert."));
    await loadBootstrap();
    await openAssignment(result.assignment_id || assignmentId);
  } catch (error) { notify(error.message, true); }
}

function assignmentDialogMode(mode) {
  const editing = mode === "edit";
  const duplicating = mode === "duplicate";
  byId("assignmentDialogEyebrow").textContent = tr(editing ? "Rediger oppdrag" : duplicating ? "Kopier oppdrag" : "Nytt oppdrag");
  byId("assignmentDialogTitle").textContent = tr(editing ? "Oppdater oppdraget" : duplicating ? "Tilpass kopien" : "Definer oppdraget");
  byId("assignmentDialogIntro").textContent = tr(editing ? "Endringen lager en ny oppdragsversjon og registreres i historikken." : duplicating ? "Kopien opprettes først når du publiserer den." : "Skill mellom kjente fakta, antakelser og det den tildelte personen må avklare.");
  byId("assignmentSubmitButton").textContent = tr(editing ? "Oppdater oppdrag" : duplicating ? "Opprett kopi" : "Publiser oppdrag");
  byId("assignmentAssigneeField").hidden = editing;
}

function fillAssignmentFormFromItem(item, { copy = false } = {}) {
  byId("assignmentTitleInput").value = `${item.title || ""}${copy ? isEnglish() ? " (copy)" : " (kopi)" : ""}`;
  byId("assignmentPurposeInput").value = item.purpose || "";
  byId("knownScopeInput").value = item.known_scope || "";
  byId("knownConstraintsInput").value = item.known_constraints || "";
  document.querySelectorAll('input[name="workFamily"]').forEach((input) => { input.checked = (item.work_families || []).includes(input.value); });
  byId("customerInput").value = item.customer_id || "";
  byId("assigneesInput").value = "";
  syncNewCustomerFields();
}

async function openEditAssignmentDialog() {
  if (!state.current || !canProvide()) return;
  await loadCustomers();
  const item = state.current.assignment;
  const form = byId("assignmentForm");
  form.reset();
  form.dataset.assignmentId = item.id;
  assignmentDialogMode("edit");
  fillAssignmentFormFromItem(item);
  byId("assignmentDialog").showModal();
}

async function openDuplicateAssignmentDialog() {
  if (!state.current || !canProvide()) return;
  await Promise.all([loadMembers(), loadCustomers()]);
  const form = byId("assignmentForm");
  form.reset();
  form.dataset.assignmentId = "";
  assignmentDialogMode("duplicate");
  fillAssignmentFormFromItem(state.current.assignment, { copy: true });
  byId("assignmentDialog").showModal();
}

async function deleteAssignment() {
  if (!state.current || !canProvide()) return;
  const assignmentId = state.current.assignment.id;
  if (!window.confirm(tr("Slette dette oppdraget? Handlingen registreres i historikken."))) return;
  try {
    await api(`/api/assignments/${encodeURIComponent(assignmentId)}`, { method: "DELETE" });
    state.current = null;
    notify(tr("Oppdraget er slettet."));
    await loadBootstrap();
    showView("assignments");
  } catch (error) { notify(error.message, true); }
}

async function reviewSubmission(event) {
  event.preventDefault();
  const submissionId = byId("reviewForm").dataset.submissionId;
  const findings = byId("reviewFindings").value.split("\n").map((line) => line.trim()).filter(Boolean);
  try {
    await api(`/api/submissions/${encodeURIComponent(submissionId)}/review`, { method: "POST", body: { decision: byId("reviewDecision").value, summary: byId("reviewSummary").value, findings } });
    byId("reviewDialog").close();
    notify("Vurderingen er lagret.");
    const assignmentId = state.current.assignment.id;
    await loadBootstrap();
    await openAssignment(assignmentId);
  } catch (error) { notify(error.message, true); }
}

async function reviewCompletionSubmission(event) {
  event.preventDefault();
  const completionSubmissionId = byId("completionReviewForm").dataset.completionSubmissionId;
  const findings = byId("completionReviewFindings").value.split("\n").map((line) => line.trim()).filter(Boolean);
  try {
    await api(`/api/completion-submissions/${encodeURIComponent(completionSubmissionId)}/review`, {
      method: "POST",
      body: { decision: byId("completionReviewDecision").value, summary: byId("completionReviewSummary").value, findings },
    });
    byId("completionReviewDialog").close();
    notify("Vurderingen av utførelsen er lagret.");
    const assignmentId = state.current.assignment.id;
    await loadBootstrap();
    await openAssignment(assignmentId);
  } catch (error) { notify(error.message, true); }
}

async function saveProfile(event) {
  event.preventDefault();
  try {
    const result = await api("/api/profile", { method: "PUT", body: { display_name: byId("displayNameInput").value, role_title: byId("roleTitleInput").value, primary_family: byId("primaryFamilyInput").value, phone: byId("phoneInput").value } });
    state.user.name = result.name;
    state.user.profile = result.profile;
    renderIdentity();
    notify("Profilen er lagret.");
    await loadMembers();
  } catch (error) { notify(error.message, true); }
}

function openOrganizationSettings() {
  if (!activeMembership() || !activeRoles().has("admin")) return;
  openSettings("organization");
}

async function saveOrganizationSettings(event) {
  event.preventDefault();
  try {
    await api(`/api/organizations/${encodeURIComponent(state.activeOrgId)}`, {
      method: "PUT",
      body: {
        name: byId("organizationSettingsName").value,
        organization_type: byId("organizationSettingsType").value,
        organization_number: byId("organizationNumberInput").value,
        address: byId("organizationAddressInput").value,
        contact_email: byId("organizationContactEmailInput").value,
        phone: byId("organizationPhoneInput").value,
      },
    });
    notify("Organisasjonen er oppdatert.");
    await loadBootstrap();
    await loadMembers();
    openSettings("organization");
  } catch (error) { notify(error.message, true); }
}

async function openAssignmentDialog() {
  if (!canProvide()) return;
  await Promise.all([loadMembers(), loadCustomers()]);
  const form = byId("assignmentForm");
  form.reset();
  form.dataset.assignmentId = "";
  assignmentDialogMode("create");
  document.querySelector('input[name="workFamily"][value="electro"]').checked = true;
  syncNewCustomerFields();
  byId("assignmentDialog").showModal();
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
  document.querySelectorAll("[data-view-link]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.viewLink)));
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => byId(button.dataset.close).close()));
  byId("homeButton").addEventListener("click", () => showView("overview"));
  byId("topbarAssistant").addEventListener("click", () => {
    const helper = byId("topbarAssistant");
    if (helper.dataset.nextAction === "assignment" && helper.dataset.assignmentId) openAssignment(helper.dataset.assignmentId);
    else if (helper.dataset.nextAction === "invite") openMemberInviteDialog();
    else if (helper.dataset.nextAction === "assignments") showView("assignments");
  });
  byId("backButton").addEventListener("click", () => { state.current = null; renderSidebarAssignments(); showView(state.lastListView || "assignments"); });
  ["newAssignmentButton", "newAssignmentListButton"].forEach((id) => byId(id).addEventListener("click", openAssignmentDialog));
  byId("inviteMemberButton").addEventListener("click", openMemberInviteDialog);
  byId("editProfileButton").addEventListener("click", () => openSettings("profile"));
  byId("editOrganizationButton").addEventListener("click", openOrganizationSettings);
  ["createFirstOrganizationButton", "createOrganizationTopButton"].forEach((id) => byId(id).addEventListener("click", () => byId("organizationDialog").showModal()));
  byId("profileButton").addEventListener("click", () => openSettings("profile"));
  byId("themeToggle")?.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    applyTheme(current === "dark" ? "light" : "dark", true);
  });
  byId("organizationForm").addEventListener("submit", createOrganization);
  byId("memberForm").addEventListener("submit", createOrganizationJoinLink);
  byId("memberRoleForm").addEventListener("submit", saveMemberRoles);
  byId("copyInviteLinkButton").addEventListener("click", copyOrganizationJoinLink);
  byId("revokeInviteLinkButton").addEventListener("click", revokeOrganizationJoinLink);
  byId("assignmentForm").addEventListener("submit", saveAssignment);
  byId("lateAssignmentForm").addEventListener("submit", assignAvailableAssignment);
  byId("assignmentTeamOptions").addEventListener("change", () => syncProfessionalResponsibleOptions());
  byId("evidenceForm").addEventListener("submit", registerEvidence);
  byId("reviewForm").addEventListener("submit", reviewSubmission);
  byId("completionReviewForm").addEventListener("submit", reviewCompletionSubmission);
  byId("profileForm").addEventListener("submit", saveProfile);
  byId("organizationSettingsForm").addEventListener("submit", saveOrganizationSettings);
  byId("documentPackageForm").addEventListener("submit", issueDocumentPackage);
  byId("documentGrantForm").addEventListener("submit", grantDocumentAccess);
  byId("grantTypeInput").addEventListener("change", syncGrantExpiry);
  byId("customerInput").addEventListener("change", syncNewCustomerFields);
  byId("documentSearchInput").addEventListener("input", renderDocumentation);
  byId("documentCustomerFilter").addEventListener("change", renderDocumentation);
  byId("documentMidnightFilter").addEventListener("change", renderDocumentation);
  byId("documentSortFilter").addEventListener("change", renderDocumentation);
  document.querySelectorAll("[data-settings-tab]").forEach((button) => button.addEventListener("click", () => showSettingsTab(button.dataset.settingsTab)));
  byId("saveDraftButton").addEventListener("click", () => saveDraft(true));
  byId("saveCompletionButton").addEventListener("click", () => saveCompletion(true));
  byId("planningForm").addEventListener("input", () => { storeLocalDraft(); renderAssistantPanel(); window.clearTimeout(state.saveTimer); state.saveTimer = window.setTimeout(() => saveDraft(false), 1400); });
  byId("completionForm").addEventListener("input", () => { storeLocalCompletionDraft(); window.clearTimeout(state.completionSaveTimer); state.completionSaveTimer = window.setTimeout(() => saveCompletion(false), 1400); });
  document.addEventListener("click", (event) => {
    const card = event.target.closest("[data-assignment-id]");
    if (card) openAssignment(card.dataset.assignmentId);
    const action = event.target.closest("[data-assignment-action]");
    if (action) assignmentAction(action.dataset.assignmentAction);
    if (event.target.closest("[data-claim-assignment]")) claimAssignment();
    if (event.target.closest("[data-assign-later]")) openLateAssignmentDialog();
    if (event.target.closest("[data-duplicate-assignment]")) openDuplicateAssignmentDialog();
    if (event.target.closest("[data-edit-assignment]")) openEditAssignmentDialog();
    if (event.target.closest("[data-delete-assignment]")) deleteAssignment();
    const review = event.target.closest("[data-review-submission]");
    if (review) openReview(review.dataset.reviewSubmission);
    const completionReview = event.target.closest("[data-review-completion]");
    if (completionReview) openCompletionReview(completionReview.dataset.reviewCompletion);
    const share = event.target.closest("[data-share-package]");
    if (share) openDocumentGrant(share.dataset.sharePackage);
    const verify = event.target.closest("[data-verify-package]");
    if (verify) verifyDocumentPackage(verify.dataset.verifyPackage);
    if (event.target.closest("[data-verify-demo-package]")) verifyDemoPackage();
    if (event.target.closest("[data-open-demo-share]")) openDemoShare();
    const demoAccess = event.target.closest("[data-demo-access-key]");
    if (demoAccess) changeDemoAccess(demoAccess.dataset.demoAccessKey, demoAccess.dataset.demoAccessAction);
    const demoRecipientView = event.target.closest("[data-demo-recipient-view]");
    if (demoRecipientView) openDemoRecipientView(demoRecipientView.dataset.demoRecipientView);
    const documentButton = event.target.closest("[data-open-document]");
    if (documentButton) openDocumentDetail(documentButton.dataset.openDocument);
    const revokeGrant = event.target.closest("[data-revoke-grant]");
    if (revokeGrant) revokeDocumentAccess(revokeGrant.dataset.packageId, revokeGrant.dataset.revokeGrant);
    const open = event.target.closest("[data-open-assignment]");
    if (open) openAssignment(open.dataset.openAssignment);
    const member = event.target.closest("[data-member-id]");
    if (member) { state.selectedMemberId = member.dataset.memberId; renderMembers(); }
    if (event.target.closest("[data-edit-profile]")) openSettings("profile");
    const manageRoles = event.target.closest("[data-manage-member-roles]");
    if (manageRoles) openMemberRoleDialog(manageRoles.dataset.manageMemberRoles);
    const stepGo = event.target.closest("[data-assignment-step-go]");
    if (stepGo) goToAssignmentStep(Number(stepGo.dataset.assignmentStepGo));
    const stepNext = event.target.closest("[data-assignment-step-next]");
    if (stepNext) goToAssignmentStep(Number(stepNext.dataset.assignmentStepNext), true);
    if (event.target.closest("[data-open-member-dialog]")) openMemberInviteDialog();
    if (event.target.closest("[data-open-assignment-dialog]")) openAssignmentDialog();
    if (event.target.closest("[data-open-evidence]") || event.target.id === "addEvidenceButton") openEvidenceDialog();
    if (event.target.id === "submitPlanButton") submitPlan();
    if (event.target.id === "submitCompletionButton") submitCompletion();
    if (event.target.id === "issueDocumentButton") openDocumentPackageDialog();
    const availableLink = event.target.closest("[data-assignment-filter-link]");
    if (availableLink) {
      state.assignmentFilter = availableLink.dataset.assignmentFilterLink;
      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item.dataset.filter === state.assignmentFilter));
      showView("assignments");
      renderAssignments();
    }
  });
  document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => { state.assignmentFilter = button.dataset.filter; document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button)); renderAssignments(); }));
  window.addEventListener("online", () => { setConnectionState("online"); if (state.current?.user_roles?.includes("assigned_worker") && localStorage.getItem(localDraftKey())) saveDraft(false); if (state.current?.user_roles?.includes("assigned_worker") && localStorage.getItem(completionLocalDraftKey())) saveCompletion(false); });
  window.addEventListener("offline", () => { setConnectionState("offline"); });
  window.addEventListener("esense:languagechange", () => {
    if (!state.user) return;
    renderIdentity();
    renderAll();
    if (state.current) renderAssignment();
    if (byId("membersView").classList.contains("active")) loadMembers();
    if (byId("demoShareDialog").open) renderDemoShareDialog();
  });
}

async function initialize() {
  bindEvents();
  setConnectionState(navigator.onLine ? "online" : "offline");
  try {
    await loadBootstrap();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js?v=34").catch(() => {});
  } catch (error) {
    notify(error.message, true);
  }
}

initialize();
