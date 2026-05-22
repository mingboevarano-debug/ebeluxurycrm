document.addEventListener('DOMContentLoaded', () => {
  // Element references
  const totalLeadsEl = document.getElementById('totalLeads');
  const statusListEl = document.getElementById('statusList');
  const upcomingListEl = document.getElementById('upcomingList');
  const refreshBtn = document.getElementById('refreshBtn');
  const timerEl = document.getElementById('meetingTimer');

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
        li.textContent = `${meet.ismi || '(nomalum)'} - ${formatted}`;
        upcomingListEl.appendChild(li);
      });

      // Countdown timer for next meeting
      if (upcoming.length > 0) {
        const nextMeeting = upcoming[0];
        const targetTime = new Date(nextMeeting.uchrashuv_vaqti).getTime();
        const updateTimer = () => {
          const now = Date.now();
          let diff = Math.max(0, targetTime - now);
          const h = Math.floor(diff / 3600000);
          diff %= 3600000;
          const m = Math.floor(diff / 60000);
          diff %= 60000;
          const s = Math.floor(diff / 1000);
          timerEl.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        };
        updateTimer();
        if (window.meetingTimerInterval) clearInterval(window.meetingTimerInterval);
        window.meetingTimerInterval = setInterval(updateTimer, 1000);
      } else {
        timerEl.textContent = '-';
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
            label: 'Leads by Status',
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
            label: 'Leads per Day',
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
            label: 'Meetings per Day',
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
            label: 'Upcoming Meetings',
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
      console.error('Error loading stats:', e);
      totalLeadsEl.textContent = 'Error';
      statusListEl.innerHTML = '<li class="muted">Failed to load</li>';
      upcomingListEl.innerHTML = '<li class="muted">Failed to load</li>';
    }
  };

  refreshBtn.addEventListener('click', loadStats);
  loadStats();
});
