const fs = require('fs');
try {
  fs.copyFileSync('node_modules/three/build/three.min.js', 'three.min.js');
  console.log('three.min.js kopyalandi');
} catch (e) {
  if (fs.existsSync('three.min.js')) console.log('three.min.js zaten var');
  else { console.error('three.min.js bulunamadi'); process.exit(1); }
}
