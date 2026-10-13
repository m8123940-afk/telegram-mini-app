/*
 * GitHub Pages frontend for "Кого нет?"
 *
 * IMPORTANT:
 * 1) GitHub Pages only hosts this interface. It does not run Python.
 * 2) Before real attendance works, set API_BASE_URL to your stable HTTPS API address
 *    and adapt the request paths/payloads below to match your bot's Python API.
 * 3) Do not put BOT_TOKEN or any private secret in this file.
 */
const API_BASE_URL = ""; // Example: "https://api.example.com" — leave blank until API is configured.

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  try {
    const user = tg.initDataUnsafe?.user;
    if (user?.first_name) document.getElementById("greeting").textContent = `Привет, ${user.first_name}! Отметься на сегодня`;
  } catch (_) {}
}

const statusEl = document.getElementById("status");
const reasonsPanel = document.getElementById("reasonsPanel");
const customReason = document.getElementById("customReason");
const sendReasonBtn = document.getElementById("sendReasonBtn");
let selectedReason = "";

function setStatus(message) {
  statusEl.textContent = message;
}
function selectReason(reason, button) {
  selectedReason = reason;
  document.querySelectorAll(".reason").forEach(el => el.classList.remove("selected"));
  if (button) button.classList.add("selected");
  if (reason === "Другая причина") customReason.focus();
}
async function sendAttendance(payload) {
  if (!API_BASE_URL) {
    setStatus("Интерфейс опубликован, но API ещё не подключён. Отметка пока не сохранена.");
    return;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/api/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        initData: tg?.initData || ""
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    setStatus("Отметка отправлена. Проверь ответ бота.");
  } catch (error) {
    setStatus("Не удалось отправить отметку. Проверь подключение к серверу.");
    console.error("Attendance API error:", error);
  }
}

document.getElementById("presentBtn").addEventListener("click", () => {
  sendAttendance({ status: "present" });
});
document.getElementById("absentBtn").addEventListener("click", () => {
  reasonsPanel.hidden = false;
  reasonsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});
document.querySelectorAll(".reason").forEach(button => {
  button.addEventListener("click", () => selectReason(button.dataset.reason, button));
});
sendReasonBtn.addEventListener("click", () => {
  const reason = customReason.value.trim() || selectedReason;
  if (!reason) {
    setStatus("Сначала выбери причину или напиши свою.");
    return;
  }
  sendAttendance({ status: "absent", reason });
});
