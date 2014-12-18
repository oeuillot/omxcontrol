var exec = require('child_process').exec;
var parseurl = require('url');

var DEFAULT_PATH = '/omx';
var TMP_PATH = "/tmp/";
var commandParameters = [ "-b" ];
var MOVIES_PATH = "/home/olivier/Films/";

function omx(configuration, mapper) {
	this.configuration = configuration;
	this._map = mapper;
	return omx.express;
}

// 192.168.0.128:8080/omx/start/Films/Barbapapa/Barbapapa+-+Le+facteur.mkv

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
				omx.start(MOVIES_PATH + parts.join('/'));
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

omx.start = function(moviePathName) {
	if (this._proc) {
		return callback("Please stop");
	}
	var pipe = this._pipe;
	if (!pipe) {
		pipe = TMP_PATH + 'omxcontrol-' + (Date.now());
		exec('mkfifo ' + pipe);
		this._pipe = pipe;
	}
	var cmd = 'omxplayer ' + commandParameters.join(" ") + ' "' + moviePathName + '" < ' + pipe;
	console.log("Command=", cmd);
	var p = exec(cmd, function(error, stdout, stderr) {
		if (error) {
			console.error(error);
			return;
		}

		if (stdout) {
			console.log(stdout);
		}
		if (stderr) {
			console.error(stderr);
		}
	});
	self._proc = p;

	p.on("close", function() {
		self._proc = null;
		console.log("Process closed");
	});

	exec('echo . > ' + pipe);
};

omx.sendKey = function(key) {
	if (!this._pipe) {
		return;
	}
	exec('echo -n ' + key + ' > ' + this._pipe, function(error, stdout, stderr) {
		if (error) {
			console.error(error);
			return;
		}
	});
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