"use strict";
var jScaler = (function() {
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
				data[y][x] = (a << 24) | (r << 16) | (g << 8) | b;
			}
		}
		return data;
	}
	function fpart(n) {
		return (n % 1 + 1) % 1;
	}
	function mixColors(a, b, d) {
		var x = Math.floor((0xFF & a >> 24) * (1 - d) + (0xFF & b >> 24) * d);
		var y = Math.floor((0xFF & a >> 16) * (1 - d) + (0xFF & b >> 16) * d);
		var z = Math.floor((0xFF & a >> 8) * (1 - d) + (0xFF & b >> 8) * d);
		var w = Math.floor((0xFF & a) * (1 - d) + (0xFF & b) * d);
		return (x << 24) | (y << 16) | (z << 8) | w;
	}
	function eq(difference, threshold, x, y, z) {
		if (difference(x, y) <= threshold) {
			if (typeof z === 'undefined')
				return true;
			return (difference(x, z) <= threshold) && (difference(y, z) <= threshold);
		}
	}

	var colors = {
		//0xAARRGGBB
		rgb : {
			difference : function(a, b) {
				var r = Math.abs((0xFF0000 & a) - (0xFF0000 & b));
				var g = Math.abs((0xFF00 & a) - (0xFF00 & b));
				var b = Math.abs((0xFF & a) - (0xFF & b));
				return Math.round(Math.sqrt(r * r + g * g + b * b) * .577350); //could speed up by using a custom sqrt
			},
			mix : function(x, y, d) {
				return mixColors(x, y, d);
			}
		},
		yuv : {
			fromARGB : function(c) {
				var r = 0xFF & c >> 16;
				var g = 0xFF & c >> 8;
				var b = 0xFF & c;
				var y = 11 * r / 36 + 7 * g / 12 + b / 9;
				var u = -r / 6 - g / 3 + b / 2;
				var v = r / 2 - 5 * g / 12 - b / 12;
				u += 127.5;
				v += 127.5;
				return (0xFF000000 & c) | ((0xFF & y) << 16) | ((0xFF & u) << 8) | (0xFF & v);
			},
			toARGB : function(c) {
				var y = 0xFF & c >> 16;
				var u = 0xFF & c >> 8;
				var v = 0xFF & c;
				u -= 127.5;
				v -= 127.5;
				var r = y + u / 102 + 71 * v / 51;
				var g = y - 35 * u / 102 - 37 * v / 51;
				var b = y + 181 * u / 102 - v / 51;
				r < 0 ? (r = 0) : (r > 255) && (r = 255);
				g < 0 ? (g = 0) : (g > 255) && (g = 255);
				b < 0 ? (b = 0) : (b > 255) && (b = 255);
				return (0xFF000000 & c) | ((0xFF & r) << 16) | ((0xFF & g) << 8) | (0xFF & b);
			},
			difference : function(x, y) {
				x = this.fromARGB(x);
				y = this.fromARGB(y);
				var y = Math.abs((0xFF0000 & x) - (0xFF0000 & y));
				var u = Math.abs((0xFF00 & x) - (0xFF00 & y));
				var v = Math.abs((0xFF & x) - (0xFF & y));
				u -= 127.5;
				v -= 127.5;
				return Math.round(y + u * .145833 + v * .125000);
			},
			mix : function(x, y, d) {
				if (d === 0)
					return x;
				if (d === 1)
					return y;
				x = this.fromARGB(x);
				y = this.fromARGB(y);
				return this.toARGB(mixColors(x, y, d));
			}
		}
	}

	var edgers = {
		nearest : function(pos, max) {
			return (pos < 0) ? 0 : (pos >= max) ? max - 1 : pos;
		},
		wrap : function(pos, max) {
			return ((pos % max) + max) % max;
		}
	}

	var interpolators = {
		nearest : function(d) {
			return Math.round(d);
		},
		linear : function(d) {
			return d;
		},
		quadio : function(d) {
			return d < 0.5 ? 2 * d * d : -2 * d * (d - 2) - 1;
		},
		dither : function(d) {
			return Math.random() < d;
		}
	}

	var iterators = {
		square2 : function(data, handler) {
			var newData = new Array(Math.round(data.length * this.scale));
			for (var y = 0; y < newData.length; y++) {
				newData[y] = new Array(Math.round(data[0].length * this.scale));
				var yr = data.length / newData.length * (y + 0.5) - 0.5;
				for (var x = 0; x < newData[0].length; x++) {
					var xr = data[0].length / newData[0].length * (x + 0.5) - 0.5;

					var x0 = this.edge(Math.floor(xr), data[0].length);
					var x1 = this.edge(Math.floor(xr) + 1, data[0].length);
					var y0 = this.edge(Math.floor(yr), data.length);
					var y1 = this.edge(Math.floor(yr) + 1, data.length);

					handler.call(this, newData, x, y, fpart(xr), fpart(yr), data[y0][x0], data[y0][x1], data[y1][x0], data[y1][x1]);
				}
			}
			return newData;
		},
		square3 : function(data, handler) {
			var newData = new Array(Math.round(data.length * this.scale));
			for (var y = 0; y < newData.length; y++)
				newData[y] = new Array(Math.round(data[0].length * this.scale));
			
			for (var y = 0; y < newData.length; y++) {
				var yr = data.length / newData.length * (y + 0.5) - 0.5;
				for (var x = 0; x < newData[0].length; x++) {
					var xr = data[0].length / newData[0].length * (x + 0.5) - 0.5;

					var x0 = this.edge(Math.floor(xr), data[0].length);
					var x1 = this.edge(Math.floor(xr) + 1, data[0].length);
					var x2 = this.edge(Math.floor(xr) + 2, data[0].length);
					var y0 = this.edge(Math.floor(yr), data.length);
					var y1 = this.edge(Math.floor(yr) + 1, data.length);
					var y2 = this.edge(Math.floor(yr) + 2, data.length);

					handler.call(this, newData, x, y, fpart(xr), fpart(yr), data[y0][x0], data[y0][x1], data[y0][x2], data[y1][x0], data[y1][x1], data[y1][x2], data[y2][x0], data[y2][x1], data[y2][x2]);
				}
			}
			return newData;
		}
	}

	var algorithms = {
		none : function(data) {
			return iterators.square2.call(this, data, function(newData, x, y, xf, yf, c00, c01, c10, c11) {
				var m0 = this.color.mix(c00, c01, this.interpolator(xf));
				var m1 = this.color.mix(c10, c11, this.interpolator(xf));

				newData[y][x] = this.color.mix(m0, m1, this.interpolator(yf));
			});
		},
		eagle2x : function(data) {
			this.scale = 2;
			return iterators.square3.call(this, data, function(newData, x, y, xf, yf, c00, c01, c02, c10, c11, c12, c20, c21, c22) {
				if (x % 2 == 1 || y % 2 == 1)
					return;
				
				/*
				 * c00 c01 c02
				 * c10 c11 c12
				 * c20 c21 c22
				 */
				
				var e0 = eq(this.color.difference, this.threshold, c10, c00, c01) ? this.color.mix(this.color.mix(c10, c01, 0.5), c00, 0.5) : c11;
				var e1 = eq(this.color.difference, this.threshold, c01, c02, c12) ? this.color.mix(this.color.mix(c01, c12, 0.5), c02, 0.5) : c11;
				var e2 = eq(this.color.difference, this.threshold, c10, c20, c21) ? this.color.mix(this.color.mix(c10, c21, 0.5), c20, 0.5) : c11;
				var e3 = eq(this.color.difference, this.threshold, c21, c22, c12) ? this.color.mix(this.color.mix(c21, c12, 0.5), c22, 0.5) : c11;
				
				newData[y][x] = e0;
				newData[y][x + 1] = e1;
				newData[y + 1][x] = e2;
				newData[y + 1][x + 1] = e3;

				return newData;
			});
		}
	}

	var JScaler = function(image) {
		this.image = image;
		this.data = getData(image);
	};
	JScaler.prototype = {
		scale2 : function(argsObj) {
			var args = {
				algorithm : 'none',
				interpolator : 'nearest',
				scale : 2,
				color : 'rgb',
				threshold : 0,
				edge : 'nearest'
			};
			for ( var attr in argsObj)
				args[attr] = argsObj[attr];
			var algorithm = algorithms[args.algorithm];
			var scaler = {};
			if (typeof args.interpolator === 'function')
				scaler.interpolator = args.interpolator;
			else
				scaler.interpolator = interpolators[args.interpolator.toLowerCase()];
			scaler.scale = args.scale;
			scaler.color = colors[args.color.toLowerCase()];
			scaler.threshold = 0;
			scaler.edge = edgers[args.edge.toLowerCase()];

			this.data = algorithm.call(scaler, this.data);
			return this;
		},
		scale : function(alg, s, sy) {
			if (typeof s === 'number') {
				if (Math.round(this.data[0].length * s) < 1)
					throw 'scale is too small';
				if (typeof sy === 'undefined' && Math.round(this.data.length) * s < 1)
					throw 'scale is too small';
				if (typeof sy === 'number' && Math.round(this.data.length) * sy < 1)
					throw 'scale is too small';
			}
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
					//argb -> rgba
					newImgData.data[j++] = 0xFF & (c >> 16);
					newImgData.data[j++] = 0xFF & (c >> 8);
					newImgData.data[j++] = 0xFF & c;
					newImgData.data[j++] = 0xFF & (c >> 24);
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
					//argb -> rgba
					newImgData.data[j++] = 0xFF & (c >> 16);
					newImgData.data[j++] = 0xFF & (c >> 8);
					newImgData.data[j++] = 0xFF & c;
					newImgData.data[j++] = 0xFF & (c >> 24);
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
