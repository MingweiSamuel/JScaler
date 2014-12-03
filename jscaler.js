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
			throw 'arg must be image or canvas element';

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

	var algs = {
		nearest : function(eq, data, s) {
			(typeof s !== 'undefined') || (s = 2);
			var newData = new Array(data.length * s);
			for (var y = 0; y < data.length; y++) {
				for (var i = 0; i < s; i++)
					newData[y * s + i] = new Array(data[0].length * s);
				for (var x = 0; x < data[0].length; x++) {
					for (var yy = 0; yy < s; yy++)
						for (var xx = 0; xx < s; xx++)
							newData[y * s + yy][x * s + xx] = data[y][x];
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
			default:
				throw 'invalid scale';
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
					d = data[y][x - 1] || data[y][x];
					e = data[y][x];
					f = data[y][x + 1] || data[y][x];
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
						a = data[y - 1][x - 1] || data[y - 1][x];
						b = data[y - 1][x];
						c = data[y - 1][x + 1] || data[y - 1][x];
					}
					else {
						a = data[y][x - 1] || data[y][x];
						b = data[y][x];
						c = data[y][x + 1] || data[y][x];
					}
					d = data[y][x - 1] || data[y][x];
					e = data[y][x];
					f = data[y][x + 1] || data[y][x];
					if (y + 1 < data.length) {
						g = data[y + 1][x - 1] || data[y + 1][x];
						h = data[y + 1][x];
						i = data[y + 1][x + 1] || data[y + 1][x];
					}
					else {
						g = data[y][x - 1] || data[y][x];
						h = data[y][x];
						i = data[y][x + 1] || data[y][x];
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
			default:
				throw 'invalid scale';
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
						a = data[y - 1][x - 1] || data[y - 1][x];
						b = data[y - 1][x];
						c = data[y - 1][x + 1] || data[y - 1][x];
					}
					else {
						a = data[y][x - 1] || data[y][x];
						b = data[y][x];
						c = data[y][x + 1] || data[y][x];
					}
					d = data[y][x - 1] || data[y][x];
					e = data[y][x];
					f = data[y][x + 1] || data[y][x];
					if (y + 1 < data.length) {
						g = data[y + 1][x - 1] || data[y + 1][x];
						h = data[y + 1][x];
						i = data[y + 1][x + 1] || data[y + 1][x];
					}
					else {
						g = data[y][x - 1] || data[y][x];
						h = data[y][x];
						i = data[y][x + 1] || data[y][x];
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
						a = data[y - 1][x - 1] || data[y - 1][x];
						b = data[y - 1][x];
						c = data[y - 1][x + 1] || data[y - 1][x];
					}
					else {
						a = data[y][x - 1] || data[y][x];
						b = data[y][x];
						c = data[y][x + 1] || data[y][x];
					}
					d = data[y][x - 1] || data[y][x];
					e = data[y][x];
					f = data[y][x + 1] || data[y][x];
					if (y + 1 < data.length) {
						g = data[y + 1][x - 1] || data[y + 1][x];
						h = data[y + 1][x];
						i = data[y + 1][x + 1] || data[y + 1][x];
					}
					else {
						g = data[y][x - 1] || data[y][x];
						h = data[y][x];
						i = data[y][x + 1] || data[y][x];
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
						a = data[y - 1][x - 1] || data[y - 1][x];
						b = data[y - 1][x];
						c = data[y - 1][x + 1] || data[y - 1][x];
					}
					else {
						a = data[y][x - 1] || data[y][x];
						b = data[y][x];
						c = data[y][x + 1] || data[y][x];
					}
					d = data[y][x - 1] || data[y][x];
					e = data[y][x];
					f = data[y][x + 1] || data[y][x];
					if (y + 1 < data.length) {
						g = data[y + 1][x - 1] || data[y + 1][x];
						h = data[y + 1][x];
						i = data[y + 1][x + 1] || data[y + 1][x];
					}
					else {
						g = data[y][x - 1] || data[y][x];
						h = data[y][x];
						i = data[y][x + 1] || data[y][x];
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
			var eq = (function(threshold){ 
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
				throw 'argument must be a image or canvas element';
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
