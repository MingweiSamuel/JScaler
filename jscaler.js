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
		nearestNeighbor : function(data, s) {
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
		scalex : function(data, s) {
			switch (s) {
			case 2:
				return algs.scale2x(data);
			case 3:
				return algs.scale3x(data);
			case 4:
				return algs.scale4x(data);
			}
		},
		scale2x : function(data) {
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
					if (y - 1 >= 0)
						b = data[y - 1][x];
					else
						b = data[y][x];
					d = data[y][x - 1] || data[y][x];
					e = data[y][x];
					f = data[y][x + 1] || data[y][x];
					if (y + 1 < data.length)
						h = data[y + 1][x];
					else
						h = data[y][x];

					var e0, e1, e2, e3;
					if (b != h && d != f) {
						e0 = d == b ? d : e;
						e1 = b == f ? f : e;
						e2 = d == h ? d : e;
						e3 = h == f ? f : e;
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
		scale3x : function(data) {
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
					if (b != h && d != f) {
						e0 = d == b ? d : e;
						e1 = (d == b && e != c) || (b == f && e != a) ? b : e;
						e2 = b == f ? f : e;
						e3 = (d == b && e != g) || (d == h && e != a) ? d : e;
						e4 = e;
						e5 = (b == f && e != i) || (h == f && e != c) ? f : e;
						e6 = d == h ? d : e;
						e7 = (d == h && e != i) || (h == f && e != g) ? h : e;
						e8 = h == f ? f : e;
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
		scale4x : function(data) {
			return algs['scale2x'](algs['scale2x'](data));
		},
		eagle : function(data) {
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

					e0 = (d == a && a == b) ? a : e;
					e1 = (b == c && c == f) ? c : e;
					e2 = (d == g && g == h) ? g : e;
					e3 = (h == i && i == f) ? i : e;

					newData[y * 2][x * 2] = e0;
					newData[y * 2][x * 2 + 1] = e1;
					newData[y * 2 + 1][x * 2] = e2;
					newData[y * 2 + 1][x * 2 + 1] = e3;
				}
			}
			return newData;
		}
	};

	var JScaler = function(image) {
		this.image = image;
		this.data = getData(image);
	};
	JScaler.prototype = {
		scale : function(alg, s) {
			if (typeof s === 'undefined')
				this.data = algs[alg](this.data);
			this.data = algs[alg](this.data, s);
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
		}
	};

	/**
	 * image can be an image element or canvas element
	 */
	return function(image) {
		//create object
		return new JScaler(image);
	};
})();
