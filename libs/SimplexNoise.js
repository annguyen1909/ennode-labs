// SimplexNoise shim - minimal implementation
// This file attaches a SimplexNoise constructor to the THREE namespace so
// example passes that expect THREE.SimplexNoise work correctly.
// Based on Stefan Gustavson's public domain Simplex noise implementation.
(function(global) {
  // Minimal SimplexNoise implementation
  function SimplexNoise(randomOrSeed) {
    var i;
    if (typeof randomOrSeed == 'function') this.random = randomOrSeed;
    else if (randomOrSeed) {
      var seed = 0;
      for (i = 0; i < randomOrSeed.length; i++) seed = (seed << 5) - seed + randomOrSeed.charCodeAt(i);
      this.random = function() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    } else this.random = Math.random;

    this.p = new Uint8Array(256);
    for (i = 0; i < 256; i++) this.p[i] = i;
    for (i = 255; i > 0; i--) {
      var r = Math.floor(this.random() * (i + 1));
      var tmp = this.p[i]; this.p[i] = this.p[r]; this.p[r] = tmp;
    }
    this.perm = new Uint8Array(512);
    for (i = 0; i < 512; i++) this.perm[i] = this.p[i & 255];

    this.grad3 = new Float32Array([1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,1,0,-1,-1,0,1,0,-1,0,-1,0,1,0,1,0,-1,0,-1,0,1,1,0,1,-1,0,-1,1,0,-1,-1,0]);
  }

  SimplexNoise.prototype.dot = function(g, x, y) { return g[0]*x + g[1]*y; };

  SimplexNoise.prototype.noise = function(xin, yin) {
    var grad3 = this.grad3;
    var perm = this.perm;
    var F2 = 0.5*(Math.sqrt(3.0)-1.0);
    var G2 = (3.0-Math.sqrt(3.0))/6.0;
    var n0 = 0, n1 = 0, n2 = 0;
    var s = (xin+yin)*F2;
    var i = Math.floor(xin + s);
    var j = Math.floor(yin + s);
    var t = (i + j) * G2;
    var X0 = i - t;
    var Y0 = j - t;
    var x0 = xin - X0;
    var y0 = yin - Y0;
    var i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    var x1 = x0 - i1 + G2;
    var y1 = y0 - j1 + G2;
    var x2 = x0 - 1.0 + 2.0 * G2;
    var y2 = y0 - 1.0 + 2.0 * G2;
    var ii = i & 255;
    var jj = j & 255;
    var gi0 = (perm[ii + perm[jj]] % 12) * 3;
    var gi1 = (perm[ii + i1 + perm[jj + j1]] % 12) * 3;
    var gi2 = (perm[ii + 1 + perm[jj + 1]] % 12) * 3;
    var t0 = 0.5 - x0*x0 - y0*y0;
    if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * this.dot([grad3[gi0], grad3[gi0+1]], x0, y0); }
    var t1 = 0.5 - x1*x1 - y1*y1;
    if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * this.dot([grad3[gi1], grad3[gi1+1]], x1, y1); }
    var t2 = 0.5 - x2*x2 - y2*y2;
    if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * this.dot([grad3[gi2], grad3[gi2+1]], x2, y2); }
    return 70.0 * (n0 + n1 + n2);
  };

  // Attach to THREE if present, otherwise attach to global
  if (typeof global.THREE !== 'undefined') global.THREE.SimplexNoise = SimplexNoise;
  else global.SimplexNoise = SimplexNoise;

})(typeof window !== 'undefined' ? window : this);