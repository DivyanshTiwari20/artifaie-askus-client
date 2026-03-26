async function testLogin2() {
  const url = 'http://15.206.49.18:5000/api/auth/login';
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sharaf.abbas.khan@artifaie.com',
        password: 'password123'
      })
    });
    
    const text = await res.text();
    console.log('Login Response:', text);
  } catch (e) {
    console.error('Error:', e);
  }
}

testLogin2();
