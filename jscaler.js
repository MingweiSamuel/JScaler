JScaler = (function() {
	function getData(image) {
		var imgData;
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
		var zb = 0xFF & z >> 8;
		var za = 0xFF & z;
		var wr = 0xFF & w >> 24;
		var wg = 0xFF & w >> 16;
		var wb = 0xFF & w >> 8;
		var wa = 0xFF & w;
		var r = yr + 0.5 * d * (zr - xr + d * (2 * xr - 5 * yr + 4 * zr - wr + d * (3 * (yr - zr) + wr - xr)));
		var g = yg + 0.5 * d * (zg - xg + d * (2 * xg - 5 * yg + 4 * zg - wg + d * (3 * (yg - zg) + wg - xg)));
		var b = yb + 0.5 * d * (zb - xb + d * (2 * xb - 5 * yb + 4 * zb - wb + d * (3 * (yb - zb) + wb - xb)));
		var a = ya + 0.5 * d * (za - xa + d * (2 * xa - 5 * ya + 4 * za - wa + d * (3 * (ya - za) + wa - xa)));
		r = (r > 255) ? 255 : (r < 0) ? 0 : r;
		g = (g > 255) ? 255 : (g < 0) ? 0 : g;
		b = (b > 255) ? 255 : (b < 0) ? 0 : b;
		a = (a > 255) ? 255 : (a < 0) ? 0 : a;
		return (r << 24) | (g << 16) | (b << 8) | a;
	}

	var algs = {
		nearest : function(eq, data, sx, sy) {
			(typeof sy === 'number') || (sy = sx);
			var newData = new Array(Math.round(data.length * sy));
			for (var y = 0; y < newData.length; y++) {
				newData[y] = new Array(Math.round(data[0].length * sx));
				var yr = Math.floor(data.length * y / newData.length);
				for (var x = 0; x < newData[0].length; x++) {
					var xr = Math.floor(data[0].length * x / newData[0].length);
					newData[y][x] = data[yr][xr];
				}
			}
			return newData;
		},
		linear : function(eq, data, sx, sy) {
			(typeof sy === 'number') || (sy = sx);
			var newData = new Array(Math.round(data.length * sy));
			for (var y = 0; y < newData.length; y++) {
				newData[y] = new Array(Math.round(data[0].length * sx));
				var yr = data.length / newData.length * (y + 0.5) - 0.5;
				for (var x = 0; x < newData[0].length; x++) {
					var xr = data[0].length / newData[0].length * (x + 0.5) - 0.5;

					/* 
					 * cYX
					 * 
					 * c00--m0--c01
					 *      |
					 *     new
					 *      |
					 * c10--m1--c11
					 */
					var x0 = Math.floor(xr);
					x0 >= 0 || x0++;
					var x1 = Math.ceil(xr);
					x1 < data[0].length || x1--;
					var y0 = Math.floor(yr);
					y0 >= 0 || y0++;
					var y1 = Math.ceil(yr);
					y1 < data.length || y1--;

					var c00 = data[y0][x0];
					var c01 = data[y0][x1];
					var c10 = data[y1][x0];
					var c11 = data[y1][x1];

					var m0 = interpolateLinear(c00, c01, xr % 1);
					var m1 = interpolateLinear(c10, c11, xr % 1);

					newData[y][x] = interpolateLinear(m0, m1, yr % 1);
				}
			}
			return newData;
		},
		cubic : function(eq, data, sx, sy) {
			(typeof sy === 'number') || (sy = sx);
			var newData = new Array(Math.round(data.length * sy));
			for (var y = 0; y < newData.length; y++) {
				newData[y] = new Array(Math.round(data[0].length * sx));
				var yr = data.length / newData.length * (y + 0.5) - 0.5;
				for (var x = 0; x < newData[0].length; x++) {
					var xr = data[0].length / newData[0].length * (x + 0.5) - 0.5;

					/* 
					 * cYX
					 * 
					 *   :	x0      x1     x2      x3	
					 *   :
					 * y0:	c00 --- c01-m0-c02 --- c03
					 *                  |
					 * y1:	c10 --- c11-m1-c12 --- c13
					 *                  |
					 *                 new
					 *                  |
					 * y2:	c20 --- c21-m2-c22 --- c23
					 *                  |
					 * y3:	c30 --- c31-m3-c32 --- c33
					 */
					var y0 = Math.floor(yr) - 1;
					y0 >= 0 || (y0 = 0);
					var y1 = Math.floor(yr);
					y1 >= 0 || (y1 = 0);
					var y2 = Math.ceil(yr);
					y2 < data.length || (y2 = data.length - 1);
					var y3 = Math.ceil(yr) + 1;
					y3 < data.length || (y3 = data.length - 1);

					var x0 = Math.floor(xr) - 1;
					x0 >= 0 || (x0 = 0);
					var x1 = Math.floor(xr);
					x1 >= 0 || (x1 = 0);
					var x2 = Math.ceil(xr);
					x2 < data[0].length || (x2 = data[0].length - 1);
					var x3 = Math.ceil(xr) + 1;
					x3 < data[0].length || (x3 = data[0].length - 1);
					
					var c00 = data[y0][x0];
					var c01 = data[y0][x1];
					var c02 = data[y0][x2];
					var c03 = data[y0][x3];
					
					var c10 = data[y1][x0];
					var c11 = data[y1][x1];
					var c12 = data[y1][x2];
					var c13 = data[y1][x3];
					
					var c20 = data[y2][x0];
					var c21 = data[y2][x1];
					var c22 = data[y2][x2];
					var c23 = data[y2][x3];
					
					var c30 = data[y3][x0];
					var c31 = data[y3][x1];
					var c32 = data[y3][x2];
					var c33 = data[y3][x3];

					var d = xr % 1;
					var m0 = interpolateCubic(c00, c01, c02, c03, d);
					var m1 = interpolateCubic(c10, c11, c12, c13, d);
					var m2 = interpolateCubic(c20, c21, c22, c23, d);
					var m3 = interpolateCubic(c30, c31, c32, c33, d);

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

					/*
					 *     c01
					 * c10 c11 c12
					 *     c21
					 */
					
					var x0 = (x >= 1) ? x - 1 : x;
					var x2 = (x < data[0].length - 1) ? x + 1 : x;
					
					var y0 = (y >= 1) ? y - 1 : y;
					var y2 = (y < data.length - 1) ? y + 1 : y;
					
					var c01 = data[y0][x];
					var c10 = data[y][x0];
					var c11 = data[y][x];
					var c12 = data[y][x2];
					var c21 = data[y2][x];

					var e0, e1, e2, e3;
					if (!(eq(c01, c21) || eq(c10, c12))) {
						e00 = eq(c10, c01) ? c10 : c11;
						e01 = eq(c01, c12) ? c12 : c11;
						e10 = eq(c10, c21) ? c10 : c11;
						e11 = eq(c21, c12) ? c12 : c11;
					}
					else
						e00 = e01 = e10 = e11 = c11;

					newData[y * 2][x * 2] = e00;
					newData[y * 2][x * 2 + 1] = e01;
					newData[y * 2 + 1][x * 2] = e10;
					newData[y * 2 + 1][x * 2 + 1] = e11;
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
				
					/*
					 * c00 c01 c02
					 * c10 c11 c12
					 * c20 c21 c22
					 */
					
					var x0 = (x >= 1) ? x - 1 : x;
					var x2 = (x < data[0].length - 1) ? x + 1 : x;
					
					var y0 = (y >= 1) ? y - 1 : y;
					var y2 = (y < data.length - 1) ? y + 1 : y;
					
					var c00 = data[y0][x0];
					var c01 = data[y0][x];
					var c02 = data[y0][x2];
					var c10 = data[y][x0];
					var c11 = data[y][x];
					var c12 = data[y][x2];
					var c20 = data[y2][x0];
					var c21 = data[y2][x];
					var c22 = data[y2][x2];

					var e0, e1, e2, e3, e4, e5, e6, e7, e8;
					if (!(eq(c01, c21) || eq(c10, c12))) {
						e0 = eq(c10, c01) ? c10 : c11;
						e1 = (eq(c10, c01) && !eq(c11, c02)) || (eq(c01, c12) && !eq(c11, c00)) ? c01 : c11;
						e2 = eq(c01, c12) ? c12 : c11;
						e3 = (eq(c10, c01) && !eq(c11, c20)) || (eq(c10, c21) && !eq(c11, c00)) ? c10 : c11;
						e4 = c11;
						e5 = (eq(c01, c12) && !eq(c11, c22)) || (eq(c21, c12) && !eq(c11, c02)) ? c12 : c11;
						e6 = eq(c10, c21) ? c10 : c11;
						e7 = (eq(c10, c21) && !eq(c11, c22)) || (eq(c21, c12) && !eq(c11, c20)) ? c21 : c11;
						e8 = eq(c21, c12) ? c12 : c11;
					}
					else
						e0 = e1 = e2 = e3 = e4 = e5 = e6 = e7 = e8 = c11;

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
					
					/*
					 * c00 c01 c02
					 * c10 c11 c12
					 * c20 c21 c22
					 */
					
					var x0 = (x >= 1) ? x - 1 : x;
					var x2 = (x < data[0].length - 1) ? x + 1 : x;
					
					var y0 = (y >= 1) ? y - 1 : y;
					var y2 = (y < data.length - 1) ? y + 1 : y;
					
					var c00 = data[y0][x0];
					var c01 = data[y0][x];
					var c02 = data[y0][x2];
					var c10 = data[y][x0];
					var c11 = data[y][x];
					var c12 = data[y][x2];
					var c20 = data[y2][x0];
					var c21 = data[y2][x];
					var c22 = data[y2][x2];

					var e0 = eq(c10, c00, c01) ? c00 : c11;
					var e1 = eq(c01, c02, c12) ? c02 : c11;
					var e2 = eq(c10, c20, c21) ? c20 : c11;
					var e3 = eq(c21, c22, c12) ? c22 : c11;

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
					
					/*
					 * c00 c01 c02
					 * c10 c11 c12
					 * c20 c21 c22
					 */
					
					var x0 = (x >= 1) ? x - 1 : x;
					var x2 = (x < data[0].length - 1) ? x + 1 : x;
					
					var y0 = (y >= 1) ? y - 1 : y;
					var y2 = (y < data.length - 1) ? y + 1 : y;
					
					var c00 = data[y0][x0];
					var c01 = data[y0][x];
					var c02 = data[y0][x2];
					var c10 = data[y][x0];
					var c11 = data[y][x];
					var c12 = data[y][x2];
					var c20 = data[y2][x0];
					var c21 = data[y2][x];
					var c22 = data[y2][x2];

					var e0 = eq(c10, c00, c01) ? c00 : c11;
					var e1 = eq(c00, c01, c02) && (eq(c10, c01) || eq(c12, c01)) ? c01 : c11;
					var e2 = eq(c01, c02, c12) ? c02 : c11;
					var e3 = eq(c00, c10, c20) && (eq(c01, c10) || eq(c21, c10)) ? c10 : c11;
					var e4 = c11;
					var e5 = eq(c02, c12, c22) && (eq(c01, c12) || eq(c21, c12)) ? c12 : c11;
					var e6 = eq(c10, c20, c21) ? c20 : c11;
					var e7 = eq(c20, c21, c22) && (eq(c10, c21) || eq(c12, c21)) ? c21 : c11;
					var e8 = eq(c21, c22, c12) ? c22 : c11;

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
					
					/*
					 * c00 c01 c02
					 * c10 c11 c12
					 * c20 c21 c22
					 */
					
					var x0 = (x >= 1) ? x - 1 : x;
					var x2 = (x < data[0].length - 1) ? x + 1 : x;
					
					var y0 = (y >= 1) ? y - 1 : y;
					var y2 = (y < data.length - 1) ? y + 1 : y;
					
					var c00 = data[y0][x0];
					var c01 = data[y0][x];
					var c02 = data[y0][x2];
					var c10 = data[y][x0];
					var c11 = data[y][x];
					var c12 = data[y][x2];
					var c20 = data[y2][x0];
					var c21 = data[y2][x];
					var c22 = data[y2][x2];

					var e0 = eq(c10, c00, c01) ? c00 : c11;
					var e1 = eq(c00, c01, c02) && (eq(c10, c01) && eq(c12, c01)) ? c01 : c11;
					var e2 = eq(c01, c02, c12) ? c02 : c11;
					var e3 = eq(c00, c10, c20) && (eq(c01, c10) && eq(c21, c10)) ? c10 : c11;
					var e4 = c11;
					var e5 = eq(c02, c12, c22) && (eq(c01, c12) && eq(c21, c12)) ? c12 : c11;
					var e6 = eq(c10, c20, c21) ? c20 : c11;
					var e7 = eq(c20, c21, c22) && (eq(c10, c21) && eq(c12, c21)) ? c21 : c11;
					var e8 = eq(c21, c22, c12) ? c22 : c11;

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
		scale : function(alg, s, sy) {
			/*if (typeof s === 'number') {
				if (Math.round(this.data[0].length * s) < 2)
					throw 'scale is too small';
				if (typeof sy === 'undefined' && Math.round(this.data.length) * s < 2)
					throw 'scale is too small';
				if (typeof sy === 'number' && Math.round(this.data.length) * sy < 2)
					throw 'scale is too small';
			}*/
			if (typeof alg === 'string' && typeof algs[alg.toLowerCase()] === 'undefined')
				throw alg + 'is not a valid algorithm';
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
			var newData = algs[alg.toLowerCase()](eq, this.data, s, sy);
			this.data = newData; //if newData caused exception, it will not overwrite this.data
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
