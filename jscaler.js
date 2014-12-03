JScaler = (function() {
	function getData(image) {
		var imageData;
		if (image instanceof HTMLImageElement) {
			// create normal sized canvas
			var canvas = document.createElement('canvas');
			canvas.width = image.width;
			canvas.height = image.height;

			// copy image data
			var context = canvas.getContext('2d');
			context.drawImage(image, 0, 0);

			// get pixel data
			imgData = context.getImageData(0, 0, canvas.width, canvas.height);
		}
		else if (image instanceof HTMLCanvasElement)
			imgData = image.getContext('2d').getImageData(0, 0, image.width, image.height);
		else
			throw 'arg must be image or canvas element, not ' + typeof image;

		// convert to 2d binary array
		var data = new Array(image.height);
		var i = 0;
		for (var y = 0; y < data.length; y++) {
			data[y] = new Array(image.width);
			for (var x = 0; x < data[0].length; x++) {
				var r = 0xFF & imgData.data[i++];
				var g = 0xFF & imgData.data[i++];
				var b = 0xFF & imgData.data[i++];
				var a = 0xFF & imgData.data[i++];
				data[y][x] = (r << 24) | (g << 16) | (b << 8) | a;
			}
		}
		return data;
	}
	/**
	 * Linear interpolation x is the first color y is the second color d is the
	 * distance (0-1) between x and y
	 */
	function interpolateLinear(x, y, d) {
		var r = Math.floor((0xFF & x >> 24) * (1 - d) + (0xFF & y >> 24) * d);
		var g = Math.floor((0xFF & x >> 16) * (1 - d) + (0xFF & y >> 16) * d);
		var b = Math.floor((0xFF & x >> 8) * (1 - d) + (0xFF & y >> 8) * d);
		var a = Math.floor((0xFF & x) * (1 - d) + (0xFF & y) * d);
		return (r << 24) | (g << 16) | (b << 8) | a;
	}
	/**
	 * Cubic interpolation
	 */
	function interpolateCubic(x, y, z, w, d) {
		var xr = 0xFF & x >> 24;
		var xg = 0xFF & x >> 16;
		var xb = 0xFF & x >> 8;
		var xa = 0xFF & x;
		var yr = 0xFF & y >> 24;
		var yg = 0xFF & y >> 16;
		var yb = 0xFF & y >> 8;
		var ya = 0xFF & y;
		var zr = 0xFF & z >> 24;
		var zg = 0xFF & z >> 16;
		var za = 0xFF & z >> 8;
		var zb = 0xFF & z;
		var wr = 0xFF & w >> 24;
		var wg = 0xFF & w >> 16;
		var wa = 0xFF & w >> 8;
		var wb = 0xFF & w;
		var r = 0xFF & (yr + 0.5 * d * (zr - xr + d * (2 * xr - 5 * yr + 4 * zr - wr + d * (3 * (yr - zr) + wr - xr))));
		var g = 0xFF & (yg + 0.5 * d * (zg - xg + d * (2 * xg - 5 * yg + 4 * zg - wg + d * (3 * (yg - zg) + wg - xg))));
		var b = 0xFF & (yb + 0.5 * d * (zb - xb + d * (2 * xb - 5 * yb + 4 * zb - wb + d * (3 * (yb - zb) + wb - xb))));
		var a = 0xFF & (ya + 0.5 * d * (za - xa + d * (2 * xa - 5 * ya + 4 * za - wa + d * (3 * (ya - za) + wa - xa))));
		return (r << 24) | (g << 16) | (b << 8) | a;
	}

	var algs = {
		nearest : function(eq, data, s) {
			(typeof s !== 'undefined') || (s = 2);
			var newData = new Array(Math.floor(data.length * s));
			for (var y = 0; y < newData.length; y++) {
				newData[y] = new Array(Math.floor(data[0].length * s));
				var yr = Math.floor(data.length * y / newData.length);
				for (var x = 0; x < newData[0].length; x++) {
					var xr = Math.floor(data[0].length * x / newData[0].length);
					newData[y][x] = data[yr][xr];
				}
			}
			return newData;
		},
		linear : function(eq, data, s) {
			(typeof s !== 'undefined') || (s = 2);
			var newData = new Array(Math.floor(data.length * s));
			for (var y = 0; y < newData.length; y++) {
				newData[y] = new Array(Math.floor(data[0].length * s));
				var yr = data.length * y / newData.length;
				for (var x = 0; x < newData[0].length; x++) {
					var xr = data[0].length * x / newData[0].length;

					/*
					 * c0--c01--c1
					 *      |
					 *     new
					 *      |
					 * c2--c23--c3
					 */
					var c0 = data[Math.floor(yr)][Math.floor(xr)];
					var c1 = (Math.ceil(xr) < data[0].length) ? data[Math.floor(yr)][Math.ceil(xr)] : c0;
					if (Math.ceil(yr) < data.length) {
						var c2 = data[Math.ceil(yr)][Math.floor(xr)];
						var c3 = (Math.ceil(xr) < data[0].length) ? data[Math.ceil(yr)][Math.ceil(xr)] : c2;
					}
					else {
						c2 = c0;
						c3 = c1;
					}

					var c01 = interpolateLinear(c0, c1, xr % 1);
					var c23 = interpolateLinear(c2, c3, xr % 1);

					newData[y][x] = interpolateLinear(c01, c23, yr % 1);
				}
			}
			return newData;
		},
		cubic : function(eq, data, s) {
			(typeof s !== 'undefined') || (s = 2);
			var newData = new Array(Math.floor(data.length * s));
			for (var y = 0; y < newData.length; y++) {
				newData[y] = new Array(Math.floor(data[0].length * s));
				var yr = data.length * y / newData.length;
				for (var x = 0; x < newData[0].length; x++) {
					var xr = data[0].length * x / newData[0].length;

					/*
					 *   :	x0   x1    x2   x3	
					 *   :
					 * y0:	l0 - l4 m0 r4 - r0
					 * y1:	l1 - l5 m1 r5 - r1
					 * y2:	l2 - l6 m2 r6 - r2
					 * y3:	l3 - l7 m3 r7 - r3
					 */
					var y0 = Math.floor(yr) - 1;
					var y1 = Math.floor(yr);
					var y2 = Math.ceil(yr);
					var y3 = Math.ceil(yr) + 1;

					var x0 = Math.floor(xr) - 1;
					var x1 = Math.floor(xr);
					var x2 = Math.ceil(xr);
					var x3 = Math.ceil(xr) + 1;

					//y1
					var l5 = data[y1][x1];
					var l1 = (x0 >= 0) ? data[y1][x0] : l5;
					var r5 = (x2 < data[0].length) ? data[y1][x2] : l5;
					var r1 = (x3 < data[0].length) ? data[y1][x3] : r5;

					//y0
					if (y0 >= 0) {
						var l4 = data[y0][x1];
						var l0 = (x0 >= 0) ? data[y0][x0] : l4;
						var r4 = (x2 < data[0].length) ? data[y0][x2] : l4;
						var r0 = (x3 < data[0].length) ? data[y0][x3] : r4;
					}
					else {
						var l4 = l5;
						var l0 = l1;
						var r4 = r5;
						var r0 = r1;
					}

					//y2
					if (y2 < data.length) {
						var l6 = data[y2][x1];
						var l2 = (x0 >= 0) ? data[y2][x0] : l6;
						var r6 = (x2 < data[0].length) ? data[y2][x2] : l6;
						var r2 = (x3 < data[0].length) ? data[y2][x3] : r6;
					}
					else {
						var l6 = l5;
						var l2 = l1;
						var r6 = r5;
						var r2 = r1;
					}

					//y3
					if (y3 < data.length) {
						var l7 = data[y3][x1];
						var l3 = (x0 >= 0) ? data[y3][x0] : l7;
						var r7 = (x2 < data[0].length) ? data[y3][x2] : l7;
						var r3 = (x3 < data[0].length) ? data[y3][x3] : r7;
					}
					else {
						var l7 = l6;
						var l3 = l2;
						var r7 = r6;
						var r3 = r2;
					}

					var d = xr % 1;
					var m0 = interpolateCubic(l0, l4, r4, r0, d);
					var m1 = interpolateCubic(l1, l5, r5, r1, d);
					var m2 = interpolateCubic(l2, l6, r6, r2, d);
					var m3 = interpolateCubic(l3, l7, r7, r3, d);

					newData[y][x] = interpolateCubic(m0, m1, m2, m3, yr % 1);
				}
			}
			return newData;
		},
		advmame : function(eq, data, s) {
			switch (s) {
			case 2:
				return algs.advmame2x(eq, data);
			case 3:
				return algs.advmame3x(eq, data);
			case 4:
				return algs.advmame2x(eq, algs.advmame2x(eq, data));
			default:
				throw 'invalid scale ' + s;
			}
		},
		advmame2x : function(eq, data) {
			var newData = new Array(data.length * 2);
			for (var y = 0; y < data.length; y++) {
				newData[y * 2] = new Array(data[0].length * 2);
				newData[y * 2 + 1] = new Array(data[0].length * 2);
				for (var x = 0; x < data[0].length; x++) {

					var b, d, e, f, h, i;
					/*
					 *   b
					 * d e f
					 *   h
					 */
					b = (y - 1 >= 0) ? data[y - 1][x] : data[y][x];
					d = (x - 1 >= 0) ? data[y][x - 1] : data[y][x];
					e = data[y][x];
					f = (x + 1 < data[0].length) ? data[y][x + 1] : data[y][x];
					h = (y + 1 < data.length) ? data[y + 1][x] : data[y][x];

					var e0, e1, e2, e3;
					if (!(eq(b, h) || eq(d, f))) {
						e0 = eq(d, b) ? d : e;
						e1 = eq(b, f) ? f : e;
						e2 = eq(d, h) ? d : e;
						e3 = eq(h, f) ? f : e;
					}
					else
						e0 = e1 = e2 = e3 = e;

					newData[y * 2][x * 2] = e0;
					newData[y * 2][x * 2 + 1] = e1;
					newData[y * 2 + 1][x * 2] = e2;
					newData[y * 2 + 1][x * 2 + 1] = e3;
				}
			}
			return newData;
		},
		advmame3x : function(eq, data) {
			var newData = new Array(data.length * 3);
			for (var y = 0; y < data.length; y++) {
				newData[y * 3] = new Array(data[0].length * 3);
				newData[y * 3 + 1] = new Array(data[0].length * 3);
				newData[y * 3 + 2] = new Array(data[0].length * 3);
				for (var x = 0; x < data[0].length; x++) {

					var a, b, c, d, e, f, g, h, i;
					/*
					 * a b c
					 * d e f
					 * g h i
					 */
					if (y - 1 >= 0) {
						a = (x - 1 >= 0) ? data[y - 1][x - 1] : data[y - 1][x];
						b = data[y - 1][x];
						c = (x + 1 < data[0].length) ? data[y - 1][x + 1] : data[y - 1][x];
					}
					else {
						a = (x - 1 >= 0) ? data[y][x - 1] : data[y][x];
						b = data[y][x];
						c = (x + 1 < data[0].length) ? data[y][x + 1] : data[y][x];
					}
					d = data[y][x - 1] || data[y][x];
					e = data[y][x];
					f = data[y][x + 1] || data[y][x];
					if (y + 1 < data.length) {
						g = (x - 1 >= 0) ? data[y + 1][x - 1] : data[y + 1][x];
						h = data[y + 1][x];
						i = (x + 1 < data[0].length) ? data[y + 1][x + 1] : data[y + 1][x];
					}
					else {
						g = (x - 1 >= 0) ? data[y][x - 1] : data[y][x];
						h = data[y][x];
						i = (x + 1 < data[0].length) ? data[y][x + 1] : data[y][x];
					}

					var e0, e1, e2, e3, e4, e5, e6, e7, e8;
					if (!(eq(b, h) || eq(d, f))) {
						e0 = eq(d, b) ? d : e;
						e1 = (eq(d, b) && !eq(e, c)) || (eq(b, f) && !eq(e, a)) ? b : e;
						e2 = eq(b, f) ? f : e;
						e3 = (eq(d, b) && !eq(e, g)) || (eq(d, h) && !eq(e, a)) ? d : e;
						e4 = e;
						e5 = (eq(b, f) && !eq(e, i)) || (eq(h, f) && !eq(e, c)) ? f : e;
						e6 = eq(d, h) ? d : e;
						e7 = (eq(d, h) && !eq(e, i)) || (eq(h, f) && !eq(e, g)) ? h : e;
						e8 = eq(h, f) ? f : e;
					}
					else
						e0 = e1 = e2 = e3 = e4 = e5 = e6 = e7 = e8 = e;

					newData[y * 3][x * 3] = e0;
					newData[y * 3][x * 3 + 1] = e1;
					newData[y * 3][x * 3 + 2] = e2;
					newData[y * 3 + 1][x * 3] = e3;
					newData[y * 3 + 1][x * 3 + 1] = e4;
					newData[y * 3 + 1][x * 3 + 2] = e5;
					newData[y * 3 + 2][x * 3] = e6;
					newData[y * 3 + 2][x * 3 + 1] = e7;
					newData[y * 3 + 2][x * 3 + 2] = e8;
				}
			}
			return newData;
		},
		eagle : function(eq, data, s) {
			switch (s) {
			case 2:
				return algs.eagle2x(eq, data);
			case 3:
				return algs.eagle3x(eq, data);
			case 4:
				return algs.eagle2x(eq, algs.eagle2x(eq, data));
			default:
				throw 'invalid scale ' + s;
			}
		},
		eagle2x : function(eq, data) {
			var newData = new Array(data.length * 2);
			for (var y = 0; y < data.length; y++) {
				newData[y * 2] = new Array(data[0].length * 2);
				newData[y * 2 + 1] = new Array(data[0].length * 2);
				for (var x = 0; x < data[0].length; x++) {

					var a, b, c, d, e, f, g, h, i;
					/*
					 * a b c
					 * d e f
					 * g h i
					 */
					if (y - 1 >= 0) {
						a = (x - 1 >= 0) ? data[y - 1][x - 1] : data[y - 1][x];
						b = data[y - 1][x];
						c = (x + 1 < data[0].length) ? data[y - 1][x + 1] : data[y - 1][x];
					}
					else {
						a = (x - 1 >= 0) ? data[y][x - 1] : data[y][x];
						b = data[y][x];
						c = (x + 1 < data[0].length) ? data[y][x + 1] : data[y][x];
					}
					d = data[y][x - 1] || data[y][x];
					e = data[y][x];
					f = data[y][x + 1] || data[y][x];
					if (y + 1 < data.length) {
						g = (x - 1 >= 0) ? data[y + 1][x - 1] : data[y + 1][x];
						h = data[y + 1][x];
						i = (x + 1 < data[0].length) ? data[y + 1][x + 1] : data[y + 1][x];
					}
					else {
						g = (x - 1 >= 0) ? data[y][x - 1] : data[y][x];
						h = data[y][x];
						i = (x + 1 < data[0].length) ? data[y][x + 1] : data[y][x];
					}

					var e0, e1, e2, e3

					e0 = eq(d, a, b) ? a : e;
					e1 = eq(b, c, f) ? c : e;
					e2 = eq(d, g, h) ? g : e;
					e3 = eq(h, i, f) ? i : e;

					newData[y * 2][x * 2] = e0;
					newData[y * 2][x * 2 + 1] = e1;
					newData[y * 2 + 1][x * 2] = e2;
					newData[y * 2 + 1][x * 2 + 1] = e3;
				}
			}
			return newData;
		},
		eagle3x : function(eq, data) {
			var newData = new Array(data.length * 3);
			for (var y = 0; y < data.length; y++) {
				newData[y * 3] = new Array(data[0].length * 3);
				newData[y * 3 + 1] = new Array(data[0].length * 3);
				newData[y * 3 + 2] = new Array(data[0].length * 3);
				for (var x = 0; x < data[0].length; x++) {

					var a, b, c, d, e, f, g, h, i;
					/*
					 * a b c
					 * d e f
					 * g h i
					 */
					if (y - 1 >= 0) {
						a = (x - 1 >= 0) ? data[y - 1][x - 1] : data[y - 1][x];
						b = data[y - 1][x];
						c = (x + 1 < data[0].length) ? data[y - 1][x + 1] : data[y - 1][x];
					}
					else {
						a = (x - 1 >= 0) ? data[y][x - 1] : data[y][x];
						b = data[y][x];
						c = (x + 1 < data[0].length) ? data[y][x + 1] : data[y][x];
					}
					d = data[y][x - 1] || data[y][x];
					e = data[y][x];
					f = data[y][x + 1] || data[y][x];
					if (y + 1 < data.length) {
						g = (x - 1 >= 0) ? data[y + 1][x - 1] : data[y + 1][x];
						h = data[y + 1][x];
						i = (x + 1 < data[0].length) ? data[y + 1][x + 1] : data[y + 1][x];
					}
					else {
						g = (x - 1 >= 0) ? data[y][x - 1] : data[y][x];
						h = data[y][x];
						i = (x + 1 < data[0].length) ? data[y][x + 1] : data[y][x];
					}

					e0 = eq(d, a, b) ? a : e;
					e1 = eq(a, b, c) && (eq(d, b) || eq(f, b)) ? b : e;
					e2 = eq(b, c, f) ? c : e;
					e3 = eq(a, d, g) && (eq(b, d) || eq(h, d)) ? d : e;
					e4 = e;
					e5 = eq(c, f, i) && (eq(b, f) || eq(h, f)) ? f : e;
					e6 = eq(d, g, h) ? g : e;
					e7 = eq(g, h, i) && (eq(d, h) || eq(f, h)) ? h : e;
					e8 = eq(h, i, f) ? i : e;

					newData[y * 3][x * 3] = e0;
					newData[y * 3][x * 3 + 1] = e1;
					newData[y * 3][x * 3 + 2] = e2;
					newData[y * 3 + 1][x * 3] = e3;
					newData[y * 3 + 1][x * 3 + 1] = e4;
					newData[y * 3 + 1][x * 3 + 2] = e5;
					newData[y * 3 + 2][x * 3] = e6;
					newData[y * 3 + 2][x * 3 + 1] = e7;
					newData[y * 3 + 2][x * 3 + 2] = e8;
				}
			}
			return newData;
		},
		eagle3xr : function(eq, data) {
			var newData = new Array(data.length * 3);
			for (var y = 0; y < data.length; y++) {
				newData[y * 3] = new Array(data[0].length * 3);
				newData[y * 3 + 1] = new Array(data[0].length * 3);
				newData[y * 3 + 2] = new Array(data[0].length * 3);
				for (var x = 0; x < data[0].length; x++) {

					var a, b, c, d, e, f, g, h, i;
					/*
					 * a b c
					 * d e f
					 * g h i
					 */
					if (y - 1 >= 0) {
						a = (x - 1 >= 0) ? data[y - 1][x - 1] : data[y - 1][x];
						b = data[y - 1][x];
						c = (x + 1 < data[0].length) ? data[y - 1][x + 1] : data[y - 1][x];
					}
					else {
						a = (x - 1 >= 0) ? data[y][x - 1] : data[y][x];
						b = data[y][x];
						c = (x + 1 < data[0].length) ? data[y][x + 1] : data[y][x];
					}
					d = data[y][x - 1] || data[y][x];
					e = data[y][x];
					f = data[y][x + 1] || data[y][x];
					if (y + 1 < data.length) {
						g = (x - 1 >= 0) ? data[y + 1][x - 1] : data[y + 1][x];
						h = data[y + 1][x];
						i = (x + 1 < data[0].length) ? data[y + 1][x + 1] : data[y + 1][x];
					}
					else {
						g = (x - 1 >= 0) ? data[y][x - 1] : data[y][x];
						h = data[y][x];
						i = (x + 1 < data[0].length) ? data[y][x + 1] : data[y][x];
					}

					e0 = eq(d, a, b) ? a : e;
					e1 = eq(a, b, c) && (eq(d, b) && eq(f, b)) ? b : e;
					e2 = eq(b, c, f) ? c : e;
					e3 = eq(a, d, g) && (eq(b, d) && eq(h, d)) ? d : e;
					e4 = e;
					e5 = eq(c, f, i) && (eq(b, f) && eq(h, f)) ? f : e;
					e6 = eq(d, g, h) ? g : e;
					e7 = eq(g, h, i) && (eq(d, h) && eq(f, h)) ? h : e;
					e8 = eq(h, i, f) ? i : e;

					newData[y * 3][x * 3] = e0;
					newData[y * 3][x * 3 + 1] = e1;
					newData[y * 3][x * 3 + 2] = e2;
					newData[y * 3 + 1][x * 3] = e3;
					newData[y * 3 + 1][x * 3 + 1] = e4;
					newData[y * 3 + 1][x * 3 + 2] = e5;
					newData[y * 3 + 2][x * 3] = e6;
					newData[y * 3 + 2][x * 3 + 1] = e7;
					newData[y * 3 + 2][x * 3 + 2] = e8;
				}
			}
			return newData;
		}
	};

	var JScaler = function(image) {
		this.image = image;
		this.data = getData(image);
		this.threshold = 0;
	};
	JScaler.prototype = {
		setThreshold : function(threshold) {
			this.threshold = threshold;
			return this;
		},
		scale : function(alg, s) {
			var eq = (function(threshold) {
				return function(x, y, z) {
					var dr = Math.abs((0xFF & x >> 24) - (0xFF & y >> 24));
					var dg = Math.abs((0xFF & x >> 16) - (0xFF & y >> 16));
					var db = Math.abs((0xFF & x >> 8) - (0xFF & y >> 8));
					var da = Math.abs((0xFF & x) - (0xFF & y));
					if ((dr + dg + db + da) / 4 <= threshold) {
						if (typeof z === 'undefined')
							return true;
						return eq(x, z) && eq(y, z);
					}
					return false;
				};
			})(this.threshold);
			this.data = algs[alg.toLowerCase()](eq, this.data, s);
			return this;
		},
		render : function(image) {
			if (typeof image === 'undefined')
				image = this.image;

			// update canvas to new size
			var canvas;
			if (image instanceof HTMLCanvasElement)
				canvas = image;
			else if (image instanceof HTMLImageElement)
				canvas = document.createElement('canvas');
			else
				throw 'argument must be a image or canvas element, not ' + typeof image;
			canvas.width = this.data[0].length;
			canvas.height = this.data.length;
			var context = canvas.getContext('2d');

			// create new image data
			var newImgData = context.createImageData(canvas.width, canvas.height);
			var j = 0;
			for (var y = 0; y < this.data.length; y++) {
				for (var x = 0; x < this.data[0].length; x++) {
					var c = this.data[y][x];
					newImgData.data[j++] = 0xFF & (c >> 24);
					newImgData.data[j++] = 0xFF & (c >> 16);
					newImgData.data[j++] = 0xFF & (c >> 8);
					newImgData.data[j++] = 0xFF & c;
				}
			}

			context.putImageData(newImgData, 0, 0);
			if (image instanceof HTMLImageElement)
				image.src = canvas.toDataURL();
			return this;
		},
		reset : function() {
			this.data = getData(this.image);
			return this;
		},
		getContext : function() {
			var canvas = document.createElement('canvas');
			canvas.width = this.data[0].length;
			canvas.height = this.data.length;
			var context = canvas.getContext('2d');

			// create new image data
			var newImgData = context.createImageData(canvas.width, canvas.height);
			var j = 0;
			for (var y = 0; y < this.data.length; y++) {
				for (var x = 0; x < this.data[0].length; x++) {
					var c = this.data[y][x];
					newImgData.data[j++] = 0xFF & (c >> 24);
					newImgData.data[j++] = 0xFF & (c >> 16);
					newImgData.data[j++] = 0xFF & (c >> 8);
					newImgData.data[j++] = 0xFF & c;
				}
			}

			context.putImageData(newImgData, 0, 0);
			return context;
		},
	};

	/**
	 * image can be an image element or canvas element
	 */
	return function(image) {
		return new JScaler(image);
	};
})();
