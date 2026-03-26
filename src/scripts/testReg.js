async function test() {
  const url = 'http://15.206.49.18:5000/api/auth/register';
  console.log(`Sending POST to ${url}`);
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test2',
        email: 'test2@test.com',
        password: 'password123',
        role: 'employee'
      })
    });
    
    const text = await res.text();
    console.log('Response:', text);
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
