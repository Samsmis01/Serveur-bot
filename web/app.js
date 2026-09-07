const phone = document.querySelector('#phone');
const pair = document.querySelector('#pair');
const result = document.querySelector('#result');
const code = document.querySelector('#code');
const message = document.querySelector('#message');
const error = document.querySelector('#error');
const copy = document.querySelector('#copy');

function showError(text) {
  error.textContent = text;
  error.classList.remove('hidden');
}

pair.addEventListener('click', async () => {
  error.classList.add('hidden');
  result.classList.add('hidden');
  const value = phone.value.trim().replace(/\D/g, '');
  if (!/^\d{8,15}$/.test(value)) return showError('Numéro invalide. Exemple : 243XXXXXXXXX');

  pair.disabled = true;
  pair.textContent = 'Génération...';
  try {
    const response = await fetch('/api/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: value })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Erreur serveur');
    code.textContent = data.code;
    message.textContent = data.message || '';
    result.classList.remove('hidden');
  } catch (e) {
    showError(e.message || 'Impossible de contacter le serveur.');
  } finally {
    pair.disabled = false;
    pair.textContent = 'Générer le code';
  }
});

copy.addEventListener('click', async () => {
  await navigator.clipboard.writeText(code.textContent.replace(/-/g, ''));
  copy.textContent = 'Copié ✓';
  setTimeout(() => copy.textContent = 'Copier le code', 1500);
});
