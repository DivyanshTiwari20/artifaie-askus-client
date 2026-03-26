

async function createAdmin() {
  const url = 'http://15.206.49.18:5000/api/auth/register';
  console.log(`Sending POST to ${url}`);
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ashish Admin',
        email: 'admin@tally.com',
        password: 'password123',
        role: 'admin'
      })
    });
    
    const data = await res.json();
    console.log('Response:', data);
  } catch (e) {
    console.error('Error:', e);
  }
}

createAdmin();
