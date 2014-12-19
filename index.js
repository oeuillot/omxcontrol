var exec = require('child_process').exec;
var parseurl = require('url');
var fs = require('fs');

var NO_CACHE_CONTROL = "no-cache, private, no-store, must-revalidate, max-stale=0, max-age=1,post-check=0, pre-check=0";

var OMX_PATH = '/omx';
var TMP_PATH = "/tmp";
var COMMAND_PARAMETERS = [ "-b" ];
var MOVIES_PATH = "/home/olivier/Films";

// 192.168.0.128:8080/omx/start/Barbapapa/Barbapapa+-+Le+facteur.mkv

function omx(configuration) {
	configuration = configuration || {};

	this.configuration = configuration;

	this._omxPath = configuration.omxPath || OMX_PATH;
	this._tmpPath = configuration.tmpPath || TMP_PATH;
	this._moviesPath = configuration.moviesPath || MOVIES_PATH;
	this._commandParameters = configuration.commandParameters || COMMAND_PARAMETERS;

	var self = this;
	this._mapKey('pause', 'p');
	this._mapKey('quit', 'q', function(callback) {
		self._release();
		return callback(null);
	});
	this._mapKey('play', '.');
	this._mapKey('forward', "$'\\x1b\\x5b\\x43'");
	this._mapKey('backward', "$'\\x1b\\x5b\\x44'");

	this.express = this._express.bind(this);
}

module.exports = omx;

omx.prototype._express = function(req, res, next) {
	if (req.path.indexOf(this._omxPath) === 0) {
		// replace + and decode
		path = path.substring(this._omxPath.length);

		path = decodeURIComponent(req.path.replace(/\+/g, ' '));

		// remove leading and trailing /
		path = path.replace(/^\/|\/$/g, '');
		// split and remove leading path
		var parts = path.split('/');
		var command = parts.shift();
		var path = this._moviesPath + '/' + parts.join('/');
		if (this[command]) {
			console.log('executing', command, parts);
			this[command].call(this, path, function(error) {

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

		console.log('Unknown command', command);

	}
	next();
};

omx.prototype.start = function(moviePathName, callback) {
	if (this._proc) {
		return callback("Please stop");
	}
	var pipe = this._pipe;
	if (!pipe) {
		pipe = this._tmpPath + '/omxcontrol-' + (Date.now());
		exec('mkfifo ' + pipe);
		this._pipe = pipe;

		var self = this;
		process.on('exit', function(code) {
			self._release();
		});
	}

	var self = this;

	var cmd = 'omxplayer ' + this._commandParameters.join(" ") + ' "' + moviePathName + '" < ' + pipe;
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

omx.prototype.sendKey = function(key, callback) {
	if (!this._proc) {
		return callback("No process");
	}
	exec('echo -n ' + key + ' > ' + this._pipe, function(error, stdout, stderr) {
		if (error) {
			return callback(error);
		}

		return callback(null);
	});
};

omx.prototype._mapKey = function(command, key, then) {
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

omx.prototype._release = function() {
	if (this._pipe) {
		fs.unlink(this._pipe);
		this._pipe = null;
	}
}
