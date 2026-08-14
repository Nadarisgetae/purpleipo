async function testIPOAlerts() {
  try {
    const res = await fetch('https://api.ipoalerts.in/ipos?status=open');
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2).slice(0, 1000));
  } catch (err) {
    console.error(err);
  }
}
testIPOAlerts();
