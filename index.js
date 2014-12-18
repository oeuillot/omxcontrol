var exec = require('child_process').exec;
var parseurl = require('url');

var NO_CACHE_CONTROL = "no-cache, private, no-store, must-revalidate, max-stale=0, max-age=1,post-check=0, pre-check=0";

var DEFAULT_PATH = '/omx';
var TMP_PATH = "/tmp/";
var commandParameters = [ "-b" ];
var MOVIES_PATH = "/home/olivier/Films/";

function omx(configuration, mapper) {
	this.configuration = configuration;
	this._map = mapper;
	return omx.express;
}

// 192.168.0.128:8080/omx/start/Barbapapa/Barbapapa+-+Le+facteur.mkv

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
		var path = MOVIES_PATH + parts.join('/');
		console.log('executing', command, parts);
		if (omx[command]) {
			omx[command].call(this, path, function(error) {

				res.writeHead(200, {
					'Content-Type': 'application/json',
					'Cache-Control': NO_CACHE_CONTROL
				});

				if (error) {
					res.end('{ "returnCode": "ERROR", "message": "' + error + '"}');
					return;
				}
				res.end('{ "returnCode": "OK" }');

			});
			return;
		}
	}
	next();
};

omx.start = function(moviePathName, callback) {
	if (this._proc) {
		return callback("Please stop");
	}
	var pipe = this._pipe;
	if (!pipe) {
		pipe = TMP_PATH + 'omxcontrol-' + (Date.now());
		exec('mkfifo ' + pipe);
		this._pipe = pipe;
	}

	var self = this;

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
	if (!p) {
		return callback("Can not create process");
	}
	this._proc = p;

	p.on("close", function() {
		self._proc = null;
		console.log("Process closed");
	});

	exec('echo . > ' + pipe);

	return callback(null);
};

omx.sendKey = function(key, callback) {
	if (!this._pipe) {
		return callback("No process");
	}
	exec('echo -n ' + key + ' > ' + this._pipe, function(error, stdout, stderr) {
		if (error) {
			return callback(error);
		}

		return callback(null);
	});
};

omx.mapKey = function(command, key, then) {
	omx[command] = function(path, callback) {
		omx.sendKey(key, function(error) {
			if (error) {
				return callback(error);
			}

			if (then) {
				return then(callback);
			}
			callback(null);
		});
	};
};

omx.mapKey('pause', 'p');
omx.mapKey('quit', 'q', function(callback) {
	exec('rm ' + this._pipe);
	this._pipe = null;

	return callback(null);
});
omx.mapKey('play', '.');
omx.mapKey('forward', "$'\\x1b\\x5b\\x43'");
omx.mapKey('backward', "$'\\x1b\\x5b\\x44'");

module.exports = omx;