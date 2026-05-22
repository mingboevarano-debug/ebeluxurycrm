document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('meetingsGrid');
  const refreshBtn = document.getElementById('refreshBtn');

  // We will store all interval IDs here to clear them on refresh
  let timerIntervals = [];

  const escapeHtml = (s) => String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const loadMeetings = async () => {
    // Clear old intervals
    timerIntervals.forEach(clearInterval);
    timerIntervals = [];
    
    grid.innerHTML = `<div class="empty-state"><h2>Yuklanmoqda...</h2><p>Uchrashuvlar ma'lumotlari olinmoqda.</p></div>`;

    try {
      const res = await fetch('/api/leads?holat=uchrashuv_belgilandi');
      if (!res.ok) throw new Error('Failed to fetch leads');
      const data = await res.json();
      const items = data.items || [];

      if (items.length === 0) {
        grid.innerHTML = `<div class="empty-state"><h2>Uchrashuvlar yo'q</h2><p>Hozircha belgilangan uchrashuvlar mavjud emas.</p></div>`;
        return;
      }

      grid.innerHTML = '';

      // Sort items by meeting time ascending
      items.sort((a, b) => {
        const timeA = new Date(a.uchrashuv_vaqti || a.created_at).getTime();
        const timeB = new Date(b.uchrashuv_vaqti || b.created_at).getTime();
        return timeA - timeB;
      });

      items.forEach(lead => {
        const targetTime = new Date(lead.uchrashuv_vaqti || lead.created_at).getTime();
        const formattedTime = new Date(targetTime).toLocaleString('uz-UZ', { 
          day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' 
        });

        const card = document.createElement('div');
        card.className = 'meeting-card';
        card.innerHTML = `
          <div class="card-header">
            <div>
              <h3 class="client-name">${escapeHtml(lead.ismi) || "Noma'lum Mijoz"}</h3>
              <p class="client-phone">${escapeHtml(lead.tel) || "Telefon kiritilmagan"}</p>
            </div>
            <span class="status-badge" id="badge-${lead.id}">Kutilmoqda</span>
          </div>
          
          <div class="timer-container">
            <p class="timer-label" id="label-${lead.id}">Boshlanishiga qoldi</p>
            <p class="timer-value" id="timer-${lead.id}">00:00:00</p>
          </div>
          
          <div class="meeting-details">
            <div class="detail-row">
              <span class="detail-icon">📅</span>
              <span class="detail-text"><strong>Vaqt:</strong> ${formattedTime}</span>
            </div>
            ${lead.joyi ? `
            <div class="detail-row">
              <span class="detail-icon">📍</span>
              <span class="detail-text"><strong>Manzil:</strong> ${escapeHtml(lead.joyi)}</span>
            </div>` : ''}
            ${lead.izoh ? `
            <div class="detail-row">
              <span class="detail-icon">📝</span>
              <span class="detail-text"><strong>Izoh:</strong> ${escapeHtml(lead.izoh)}</span>
            </div>` : ''}
            ${lead.tuman ? `
            <div class="detail-row">
              <span class="detail-icon">🏙️</span>
              <span class="detail-text"><strong>Hudud:</strong> ${escapeHtml(lead.tuman)}</span>
            </div>` : ''}
          </div>
        `;
        
        grid.appendChild(card);

        // Setup timer logic for this specific card
        const updateCardTimer = () => {
          const now = Date.now();
          const timerEl = document.getElementById(`timer-${lead.id}`);
          const badgeEl = document.getElementById(`badge-${lead.id}`);
          const labelEl = document.getElementById(`label-${lead.id}`);
          
          if (!timerEl) return;

          let diff = targetTime - now;

          if (diff > 0) {
            // Future meeting (Upcoming)
            badgeEl.className = 'status-badge';
            badgeEl.textContent = 'Kutilmoqda';
            labelEl.textContent = 'Boshlanishiga qoldi';
            
            const h = Math.floor(diff / 3600000);
            diff %= 3600000;
            const m = Math.floor(diff / 60000);
            diff %= 60000;
            const s = Math.floor(diff / 1000);
            
            if (h > 24) {
              const days = Math.floor(h / 24);
              timerEl.textContent = `${days} kun ${h % 24}s`;
            } else {
              timerEl.textContent = `-${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            }
          } else {
            // Meeting time has passed
            const absDiff = Math.abs(diff);
            
            // Assume meetings last 60 minutes
            const MEETING_DURATION_MS = 60 * 60 * 1000;
            
            if (absDiff < MEETING_DURATION_MS) {
              // Live meeting
              badgeEl.className = 'status-badge live';
              badgeEl.textContent = 'Jonli (Jarayonda)';
              labelEl.textContent = "O'tgan vaqt";
              
              const h = Math.floor(absDiff / 3600000);
              let rem = absDiff % 3600000;
              const m = Math.floor(rem / 60000);
              rem %= 60000;
              const s = Math.floor(rem / 1000);
              
              timerEl.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            } else {
              // Finished / Late
              badgeEl.className = 'status-badge late';
              badgeEl.textContent = 'O\'tib ketgan';
              labelEl.textContent = 'Yakunlanganiga';
              
              const h = Math.floor(absDiff / 3600000);
              let rem = absDiff % 3600000;
              const m = Math.floor(rem / 60000);
              rem %= 60000;
              const s = Math.floor(rem / 1000);
              
              if (h > 24) {
                const days = Math.floor(h / 24);
                timerEl.textContent = `${days} kun avval`;
              } else {
                timerEl.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
              }
            }
          }
        };

        updateCardTimer();
        const intervalId = setInterval(updateCardTimer, 1000);
        timerIntervals.push(intervalId);
      });

    } catch (e) {
      console.error(e);
      grid.innerHTML = `<div class="empty-state"><h2>Xatolik</h2><p>Ma'lumotlarni yuklashda xatolik yuz berdi.</p></div>`;
    }
  };

  refreshBtn.addEventListener('click', loadMeetings);
  loadMeetings();
});
