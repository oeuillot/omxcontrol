var exec = require('child_process').exec;
var parseurl = require('url');

var DEFAULT_PATH = '/omx';
var TMP_PATH = "/tmp/";
var commandParameters = [ "-b" ];

function omx(configuration, mapper) {
	this.configuration = configuration;
	this._map = mapper;
	return omx.express;
}

omx.express = function(req, res, next) {
	if (req.path.indexOf(DEFAULT_PATH) === 0) {
		// replace + and decode
		path = decodeURIComponent(req.path.replace(/\+/g, ' '));
		// remove leading and trailing /
		path = path.replace(/^\/|\/$/g, '');
		// split and remove leading path
		var parts = path.split('/');
		parts.shift();
		var command = parts.shift();
		console.log('executing', command, parts);
		if (omx[command]) {
			if (command === 'start') {
				omx.start(parts.join('/') + '?' + parseurl.parse(req.url).query);
			} else {
				omx[command].apply(this, parts);
			}
			// prevent anything else from being served from this subpath
			res.end('executed ' + command);
			return;
		}
	}
	next();
};

omx.start = function(fn) {
	var pipe = this._pipe;
	if (!pipe) {
		pipe = TMP_PATH + 'omxcontrol-' + (Date.now());
		exec('mkfifo ' + pipe);
		this._pipe = pipe;
	}
	var map=this._map;
	if (map) {
		map(fn, cb);
	} else {
		cb(fn);
	}

	function cb(fn) {
		console.log(fn);
		exec('omxplayer ' + commandParameters.join(" ") + ' ' + fn + '" < ' + pipe, function(error, stdout, stderr) {
			console.log(stdout);
		});
		exec('echo . > ' + pipe);
	}
};

omx.sendKey = function(key) {
	if (!this._pipe) {
		return;
	}
	exec('echo -n ' + key + ' > ' + this._pipe);
};

omx.mapKey = function(command, key, then) {
	omx[command] = function() {
		omx.sendKey(key);
		if (then) {
			then();
		}
	};
};

omx.mapKey('pause', 'p');
omx.mapKey('quit', 'q', function() {
	exec('rm ' + this._pipe);
	this._pipe = null;
});
omx.mapKey('play', '.');
omx.mapKey('forward', "$'\\x1b\\x5b\\x43'");
omx.mapKey('backward', "$'\\x1b\\x5b\\x44'");

module.exports = omx;