const users = [
  { name: 'Sharaf abbas Khan', role: 'admin' },
  { name: 'Abhishek Asthana', role: 'admin' },
  { name: 'Anshuman Asthana', role: 'manager' },
  { name: 'Tyron Dela Cruz Latayan', role: 'employee' },
  { name: 'Ashutosh Kumar Singh', role: 'employee' },
  { name: 'Gulzar Ahmed', role: 'employee' },
  { name: 'Abbas Raza', role: 'employee' },
  { name: 'Ms Bhavya Srivastava', role: 'employee' },
  { name: 'CA Amrish Pandey', role: 'employee' },
  { name: 'Adv Gaurav Pandey', role: 'employee' },
  { name: 'Himanshu Bajpai', role: 'employee' },
  { name: 'Shubrasnsh kumar', role: 'employee' },
  { name: 'Ms Mohani', role: 'employee' }
];

async function createAllUsers() {
  const url = 'http://15.206.49.18:5000/api/auth/register';
  
  for (const u of users) {
    const email = u.name.toLowerCase().replace(/[^a-z0-9]/g, '.') + '@artifaie.com';
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: u.name,
          email: email,
          password: 'password123',
          role: u.role
        })
      });
      const text = await res.text();
      console.log(`Sent ${u.name}... Status: ${res.status} - ${text}`);
    } catch (e) {
      console.error(`Failed ${u.name}:`, e.message);
    }
  }
}

createAllUsers();
