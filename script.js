// script.js (Versi Supabase)

// Variabel global
const htmlEl = document.documentElement;
const modalRoot = document.getElementById('modal-root');
let currentUser = null; // Akan diisi oleh data sesi Supabase

// ===== UI helpers =====
const el = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  return div.firstChild;
};
const escapeHtml = (s) => s ? s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;') : '';
const truncate = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;

// ===== Theme Toggler Logic (Sama seperti sebelumnya) =====
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
let isDarkMode = htmlEl.classList.contains('dark-mode');

function applyTheme() {
  if (isDarkMode) {
    htmlEl.classList.add('dark-mode');
    themeIcon.textContent = '🌙';
    localStorage.setItem('obrolin_theme', 'dark');
  } else {
    htmlEl.classList.remove('dark-mode');
    themeIcon.textContent = '☀️';
    localStorage.setItem('obrolin_theme', 'light');
  }
}
themeIcon.textContent = isDarkMode ? '🌙' : '☀️';
themeToggleBtn.onclick = () => {
  isDarkMode = !isDarkMode;
  applyTheme();
};

// ===== Auth (SUPABASE) =====
async function setupAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  currentUser = session?.user ?? null;

  renderTopProfile();
  renderComposer();
  renderThreads(); // Muat ulang thread setelah status auth diketahui
  updateNotifUI(); // Muat ulang notif

  // Dengarkan perubahan status auth (login/logout)
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    renderTopProfile();
    renderComposer();
    renderThreads();
    updateNotifUI();
  });
}

function renderTopProfile() {
  const root = document.getElementById('top-profile');
  root.innerHTML = '';
  if (currentUser) {
    // Ambil nama dari metadata user
    const name = currentUser.user_metadata?.name || currentUser.email;
    const initial = name[0].toUpperCase();
    const prof = el(`<div style="display:flex;gap:8px;align-items:center"><div class="avatar">${initial}</div><div style="text-align:right"><div style="font-size:13px">${escapeHtml(name)}</div><div style="font-size:12px;color:var(--muted)">${currentUser.email}</div></div><button class="btn secondary" id="logout">Keluar</button></div>`);
    root.appendChild(prof);
    prof.querySelector('#logout').onclick = async () => {
      await supabase.auth.signOut();
    };
  } else {
    const login = el(`<div style="display:flex;gap:6px;align-items:center"><button class="btn" id="open-login">Masuk / Daftar</button></div>`);
    root.appendChild(login);
    login.querySelector('#open-login').onclick = openAuthModal;
  }
}

function openAuthModal() {
  showModal(`<div class="card" style="max-width:420px; padding:20px;"><h3>Masuk atau Daftar</h3>
    <p style="color:var(--muted); font-size:13px;" id="auth-error"></p>
    <div style="display:grid;gap:10px;margin-top:12px">
      <input type="text" id="auth-name" placeholder="Nama (hanya untuk daftar)" />
      <input type="email" id="auth-email" placeholder="Email" />
      <input type="password" id="auth-pass" placeholder="Kata sandi" />
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
        <button class="btn secondary" id="close-auth">Tutup</button>
        <button class="btn secondary" id="do-signup">Daftar</button>
        <button class="btn" id="do-login">Masuk</button>
      </div>
    </div>
  </div>`);

  const errorEl = document.getElementById('auth-error');
  document.getElementById('close-auth').onclick = closeModal;
  document.getElementById('do-signup').onclick = async () => {
    const name = document.getElementById('auth-name').value.trim();
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-pass').value;
    if (!name) {
      errorEl.textContent = 'Nama wajib diisi untuk mendaftar.';
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { name: name } }
    });

    if (error) {
      errorEl.textContent = error.message;
    } else {
      alert('Pendaftaran berhasil! Silakan cek email untuk verifikasi.');
      closeModal();
    }
  };
  document.getElementById('do-login').onclick = async () => {
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-pass').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) {
      errorEl.textContent = error.message;
    } else {
      closeModal();
    }
  };
}

// ===== Modal helpers =====
const showModal = (inner) => modalRoot.innerHTML = `<div class="modal-backdrop">${inner}</div>`;
const closeModal = () => modalRoot.innerHTML = '';

// ===== Categories (Sama seperti sebelumnya) =====
const DEFAULT_CATS = ['Teknologi', 'Lifestyle', 'Edukasi', 'Hiburan', 'Umum'];
function renderCategories(active = 'Semua') {
  const root = document.getElementById('categories');
  root.innerHTML = '';
  ['Semua', ...DEFAULT_CATS].forEach(c => {
    const d = el(`<div class="cat ${c === active ? 'active' : ''}" data-cat="${c}">${c}</div>`);
    d.onclick = () => { renderCategories(c); renderThreads(c); document.getElementById('thread-category').value = (DEFAULT_CATS.includes(c) ? c : DEFAULT_CATS[0]); };
    root.appendChild(d);
  });
}

// ===== Composer (Sama seperti sebelumnya) =====
function renderComposer() {
  document.getElementById('composer-avatar').textContent = currentUser ? (currentUser.user_metadata?.name?.[0].toUpperCase() || 'G') : 'G';
  const sel = document.getElementById('thread-category');
  sel.innerHTML = '';
  DEFAULT_CATS.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
  document.getElementById('post-thread').onclick = postThread;
  document.getElementById('clear-thread').onclick = () => {
    document.getElementById('thread-title').value = '';
    document.getElementById('thread-body').value = '';
    document.getElementById('thread-media-url').value = '';
  };
}

// ===== SUPABASE CRUD Functions =====

async function postThread() {
  if (!currentUser) { openAuthModal(); return; }
  const title = document.getElementById('thread-title').value.trim();
  const body = document.getElementById('thread-body').value.trim();
  const category = document.getElementById('thread-category').value;
  const mediaUrl = document.getElementById('thread-media-url').value.trim();

  if (!title || !body) { alert('Judul dan isi thread wajib diisi.'); return; }

  const newThread = {
    title,
    body,
    category,
    media_url: mediaUrl || null,
    author_id: currentUser.id,
    author_name: currentUser.user_metadata.name
  };

  const { error } = await supabase.from('threads').insert(newThread);

  if (error) {
    console.error('Error posting thread:', error);
    alert('Gagal memposting thread. Cek RLS policy Anda.');
  } else {
    renderThreads(); // Muat ulang semua thread
    document.getElementById('thread-title').value = '';
    document.getElementById('thread-body').value = '';
    document.getElementById('thread-media-url').value = '';
  }
}

async function renderThreads(filter = 'Semua') {
  const list = document.getElementById('threads-list');
  list.innerHTML = '<div class="card" style="text-align:center; padding: 20px;">Memuat thread...</div>';

  let query = supabase.from('threads').select('*').order('created_at', { ascending: false });

  if (filter !== 'Semua') {
    query = query.eq('category', filter);
  }

  const { data: threads, error } = await query;

  if (error) {
    console.error('Error fetching threads:', error);
    list.innerHTML = '<div class="card" style="text-align:center; padding: 20px;">Gagal memuat thread.</div>';
    return;
  }

  if (threads.length === 0) {
    list.innerHTML = '<div class="card" style="text-align:center; padding: 20px;">Belum ada thread. Jadilah yang pertama!</div>';
    return;
  }
  
  list.innerHTML = '';
  threads.forEach(t => {
    // Menghitung jumlah balasan, asumsikan kita akan tambah kolom replies_count
    const repliesCount = t.replies_count || 0; 
    const mediaPreview = createMediaElement(t.media_url);
    const item = el(`
      <div class="card thread" style="padding:15px">
        <div style="display:flex;gap:12px;align-items:center">
          <div class="vote">
            <button class="up" data-id="${t.id}">▲</button>
            <div class="votes-count">${t.votes}</div>
            <button class="down" data-id="${t.id}">▼</button>
          </div>
        </div>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:start">
            <div>
              <div style="font-weight:700">${escapeHtml(t.title)}</div>
              <div class="meta">oleh ${escapeHtml(t.author_name)} • ${new Date(t.created_at).toLocaleString()}</div>
            </div>
            <div class="meta">${escapeHtml(t.category)}</div>
          </div>
          <div style="margin-top:8px;color:var(--muted);">${escapeHtml(truncate(t.body, 200))}</div>
          ${mediaPreview}
          <div style="margin-top:10px;display:flex;gap:8px">
            <button class="btn small" data-id="${t.id}" data-action="open">Buka (${repliesCount} Balasan)</button>
          </div>
        </div>
      </div>
    `);
    list.appendChild(item);

    // Event listeners
    item.querySelector('[data-action=open]').onclick = () => openThread(t.id);
    const voteCountEl = item.querySelector('.votes-count');
    item.querySelector('.up').onclick = () => updateVote('threads', t.id, t.votes + 1, voteCountEl);
    item.querySelector('.down').onclick = () => updateVote('threads', t.id, t.votes - 1, voteCountEl);
  });
}

async function openThread(id) {
    // ... (Fungsi ini akan kita buat lebih detail di langkah selanjutnya)
    // Untuk sekarang, kita bisa membuat versi sederhananya
    alert("Fungsi 'Buka Thread' belum diimplementasikan sepenuhnya dengan Supabase.");
}

async function updateVote(table, id, newCount, element) {
    if (!currentUser) { openAuthModal(); return; }
    
    const { error } = await supabase.from(table).update({ votes: newCount }).eq('id', id);

    if (error) {
        console.error('Gagal update vote:', error);
        alert('Gagal memberikan vote.');
    } else {
        element.textContent = newCount;
    }
}

// Helper untuk media (sama seperti sebelumnya)
function createMediaElement(url) {
  if (!url) return '';
  const ext = url.split('.').pop().toLowerCase().split('?')[0];
  let mediaHtml = '';

  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    mediaHtml = `<img src="${url}" alt="Thread Media" loading="lazy">`;
  } else if (['mp4', 'webm', 'ogg'].includes(ext)) {
    mediaHtml = `<video src="${url}" controls loading="lazy"></video>`;
  }

  return mediaHtml ? `<div class="thread-media">${mediaHtml}</div>` : '';
}

// Placeholder untuk notifikasi
function updateNotifUI() { 
    // Fungsi notifikasi perlu dibangun ulang dengan tabel Supabase
}

// ===== Bootstrap / Initial Load =====
document.getElementById('new-thread-btn').onclick = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); document.getElementById('thread-title').focus(); };
document.getElementById('notif-count').textContent = '';

renderCategories();
setupAuth(); // Memulai proses autentikasi
