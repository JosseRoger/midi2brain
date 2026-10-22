// Contact form: posts to Web3Forms, which forwards to the owner's inbox.
// The destination address is tied to the access key on web3forms.com, never in this code.
const WEB3FORMS_KEY = '04c0936d-934c-422b-af27-11442e25a11b';

$('contact-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target, status = $('contact-status'), btn = form.querySelector('button[type="submit"]');
  if (!form.checkValidity()) { status.textContent = 'Please fill in all fields with a valid email.'; return; }
  const data = Object.fromEntries(new FormData(form));
  if (data.botcheck) return;
  btn.disabled = true; status.textContent = 'Sending…';
  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...data, access_key: WEB3FORMS_KEY, subject: 'midi2brain contact: ' + data.name, from_name: 'midi2brain' }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    form.reset(); status.textContent = 'Thanks, your message was sent.';
  } catch (err) {
    status.textContent = 'Sorry, the message could not be sent' + (err.message ? ` (${err.message})` : '') + '. Please try again later.';
  } finally {
    btn.disabled = false;
  }
});
