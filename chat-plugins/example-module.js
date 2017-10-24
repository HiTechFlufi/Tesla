'use strict';

/**@type {{[k: string]: Command | string}} */
let commands = {
	about: function (target, room, user) {
		if (!(room instanceof Users.User) && !user.hasRank(room, '+')) return;
		this.say("test");
	},
};

class Plugin {
	constructor() {
		this.name = "Example";
		this.data = {};
		this.commands = commands;
	}

	onLoad() {
		this.loadData();
	}

	loadData() {
		// initialization that requires the plugin to be in the global namespace
	}
}

module.exports = new Plugin();
