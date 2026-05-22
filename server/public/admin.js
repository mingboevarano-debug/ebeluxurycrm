document.addEventListener('DOMContentLoaded', () => {
  // Element references
  const totalLeadsEl = document.getElementById('totalLeads');
  const statusListEl = document.getElementById('statusList');
  const upcomingListEl = document.getElementById('upcomingList');
  const refreshBtn = document.getElementById('refreshBtn');
  const exportBtn = document.getElementById('exportBtn');
  const exportCardBtn = document.getElementById('exportCardBtn');
  const timerEl = document.getElementById('meetingTimer');

  const triggerExport = () => { window.location.href = '/api/admin/leads/export'; };
  
  if (exportBtn) exportBtn.addEventListener('click', triggerExport);
  if (exportCardBtn) exportCardBtn.addEventListener('click', triggerExport);

  // Chart instances (will be overwritten on refresh)
  let statusChart = null;
  let upcomingChart = null;
  let statusPieChart = null;
  let leadsLineChart = null;
  let meetingsLineChart = null;

  const loadStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();

      // Total leads
      totalLeadsEl.textContent = data.total || 0;

      // Status list (textual)
      statusListEl.innerHTML = '';
      (data.byStatus || []).forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item._id}: ${item.count}`;
        statusListEl.appendChild(li);
      });

      // Upcoming meetings list (textual)
      upcomingListEl.innerHTML = '';
      const upcoming = data.upcoming || [];
      upcoming.forEach(meet => {
        const li = document.createElement('li');
        const date = new Date(meet.uchrashuv_vaqti);
        const formatted = isNaN(date) ? meet.uchrashuv_vaqti : date.toLocaleString();
        li.textContent = `${meet.ismi || '(Noma\'lum)'} - ${formatted}`;
        upcomingListEl.appendChild(li);
      });

      // Premium Countdown timer for next meeting
      if (upcoming.length > 0) {
        const nextMeeting = upcoming[0];
        const targetTime = new Date(nextMeeting.uchrashuv_vaqti).getTime();
        
        // Update DOM elements
        document.getElementById('meetingTitle').textContent = nextMeeting.ismi || 'Noma\'lum Lid';
        document.getElementById('meetingTime').textContent = new Date(nextMeeting.uchrashuv_vaqti).toLocaleString();
        
        const badge = document.getElementById('meetingStatusBadge');
        const progress = document.getElementById('meetingProgress');
        const startBtn = document.getElementById('startMeetingBtn');
        const pauseBtn = document.getElementById('pauseMeetingBtn');
        const endBtn = document.getElementById('endMeetingBtn');
        
        startBtn.disabled = false;
        
        // Local state for demonstration
        let meetingState = 'upcoming'; // upcoming, live, paused, finished
        let durationSeconds = 0;
        const EXPECTED_DURATION = 30 * 60; // 30 minutes in seconds

        startBtn.onclick = () => {
          meetingState = 'live';
          badge.className = 'status-badge live';
          badge.textContent = 'Jonli';
          startBtn.disabled = true;
          pauseBtn.disabled = false;
          endBtn.disabled = false;
        };

        pauseBtn.onclick = () => {
          if (meetingState === 'live') {
            meetingState = 'paused';
            badge.className = 'status-badge upcoming';
            badge.textContent = 'To\'xtatilgan';
            pauseBtn.textContent = 'Davom etish';
          } else if (meetingState === 'paused') {
            meetingState = 'live';
            badge.className = 'status-badge live';
            badge.textContent = 'Jonli';
            pauseBtn.textContent = 'To\'xtatib turish';
          }
        };

        endBtn.onclick = () => {
          meetingState = 'finished';
          badge.className = 'status-badge finished';
          badge.textContent = 'Tugallangan';
          startBtn.disabled = true;
          pauseBtn.disabled = true;
          endBtn.disabled = true;
          progress.style.width = '100%';
        };

        const updateTimer = () => {
          const now = Date.now();
          
          if (meetingState === 'upcoming') {
            let diff = Math.max(0, targetTime - now);
            const h = Math.floor(diff / 3600000);
            diff %= 3600000;
            const m = Math.floor(diff / 60000);
            diff %= 60000;
            const s = Math.floor(diff / 1000);
            timerEl.textContent = `-${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
          } else if (meetingState === 'live') {
            durationSeconds++;
            const h = Math.floor(durationSeconds / 3600);
            const m = Math.floor((durationSeconds % 3600) / 60);
            const s = durationSeconds % 60;
            timerEl.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            
            // Update progress bar
            const percent = Math.min(100, (durationSeconds / EXPECTED_DURATION) * 100);
            progress.style.width = `${percent}%`;
          }
        };
        
        updateTimer();
        if (window.meetingTimerInterval) clearInterval(window.meetingTimerInterval);
        window.meetingTimerInterval = setInterval(updateTimer, 1000);
      } else {
        document.getElementById('meetingTitle').textContent = 'Kelgusi uchrashuvlar yo\'q';
        document.getElementById('meetingTime').textContent = '--:--';
        timerEl.textContent = '00:00:00';
        if (window.meetingTimerInterval) clearInterval(window.meetingTimerInterval);
      }

      // ----- Chart.js visualizations -----

      // Status Bar Chart
      const statusCtx = document.getElementById('statusChart').getContext('2d');
      const statusLabels = (data.byStatus || []).map(s => s._id);
      const statusCounts = (data.byStatus || []).map(s => s.count);
      if (statusChart) statusChart.destroy();
      statusChart = new Chart(statusCtx, {
        type: 'bar',
        data: {
          labels: statusLabels,
          datasets: [{
            label: 'Holat bo\'yicha Lidlar',
            data: statusCounts,
            backgroundColor: 'rgba(122, 167, 255, 0.6)',
            borderColor: 'rgba(122, 167, 255, 1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true } }
        }
      });

      // Status Pie Chart
      const statusPieCtx = document.getElementById('statusPieChart').getContext('2d');
      if (statusPieChart) statusPieChart.destroy();
      const pieColors = statusLabels.map((_, i) => `hsla(${(i * 60) % 360}, 70%, 60%, 0.6)`);
      statusPieChart = new Chart(statusPieCtx, {
        type: 'pie',
        data: {
          labels: statusLabels,
          datasets: [{
            data: statusCounts,
            backgroundColor: pieColors,
            borderColor: 'rgba(255,255,255,0.8)',
            borderWidth: 1
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });

      // Leads per Day Line Chart
      const leadsLineCtx = document.getElementById('leadsLineChart').getContext('2d');
      const leadsLabels = (data.leadsPerDay || []).map(d => d._id);
      const leadsCounts = (data.leadsPerDay || []).map(d => d.count);
      if (leadsLineChart) leadsLineChart.destroy();
      leadsLineChart = new Chart(leadsLineCtx, {
        type: 'line',
        data: {
          labels: leadsLabels,
          datasets: [{
            label: 'Kunlik Lidlar',
            data: leadsCounts,
            fill: false,
            borderColor: 'rgba(54, 162, 235, 0.8)',
            tension: 0.1
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });

      // Meetings per Day Line Chart
      const meetingsLineCtx = document.getElementById('meetingsLineChart').getContext('2d');
      const meetingsLabels = (data.meetingsPerDay || []).map(d => d._id);
      const meetingsCounts = (data.meetingsPerDay || []).map(d => d.count);
      if (meetingsLineChart) meetingsLineChart.destroy();
      meetingsLineChart = new Chart(meetingsLineCtx, {
        type: 'line',
        data: {
          labels: meetingsLabels,
          datasets: [{
            label: 'Kunlik Uchrashuvlar',
            data: meetingsCounts,
            fill: false,
            borderColor: 'rgba(255, 99, 132, 0.8)',
            tension: 0.1
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });

      // Upcoming Meetings Line Chart
      const upcomingCtx = document.getElementById('upcomingChart').getContext('2d');
      const meetLabels = (data.upcoming || []).map(m => {
        const d = new Date(m.uchrashuv_vaqti);
        return isNaN(d) ? m.uchrashuv_vaqti : d.toLocaleString();
      });
      const meetValues = (data.upcoming || []).map(() => 1);
      if (upcomingChart) upcomingChart.destroy();
      upcomingChart = new Chart(upcomingCtx, {
        type: 'line',
        data: {
          labels: meetLabels,
          datasets: [{
            label: 'Kelgusi Uchrashuvlar',
            data: meetValues,
            fill: false,
            borderColor: 'rgba(255, 99, 132, 0.8)',
            tension: 0.1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { display: false } }
        }
      });
    } catch (e) {
      console.error('Statistikani yuklashda xatolik:', e);
      totalLeadsEl.textContent = 'Xatolik';
      statusListEl.innerHTML = '<li class="muted">Yuklashda xatolik yuz berdi</li>';
      upcomingListEl.innerHTML = '<li class="muted">Yuklashda xatolik yuz berdi</li>';
    }
  };

  refreshBtn.addEventListener('click', loadStats);
  loadStats();
});
