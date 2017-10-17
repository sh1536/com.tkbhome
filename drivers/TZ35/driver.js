'use strict';

const path = require('path');
const ZwaveDriver = require('homey-zwavedriver');
const singlePress = {};

// TZ35S: http://www.tkbhome.com/?cn-p-d-263.html
// TZ35D: http://www.tkbhome.com/?cn-p-d-262.html
// TZ55S: http://www.tkbhome.com/?cn-p-d-265.html
// TZ55D: http://www.tkbhome.com/?cn-p-d-266.html

module.exports = new ZwaveDriver( path.basename(__dirname), {
	capabilities: {
		onoff: {
			command_class: 'COMMAND_CLASS_SWITCH_MULTILEVEL',
			command_set: 'SWITCH_MULTILEVEL_SET',
			command_set_parser: (value, node) => {
				if (node && typeof node.instance.CommandClass.COMMAND_CLASS_SWITCH_MULTILEVEL !== 'undefined') {
					setTimeout(() => {
						node.instance.CommandClass.COMMAND_CLASS_SWITCH_MULTILEVEL.SWITCH_MULTILEVEL_GET();
					}, 2500);
				}
				return {
					Value: (value > 0) ? 'on/enable' : 'off/disable',
				};
			},
		},

		dim: {
			command_class: 'COMMAND_CLASS_SWITCH_MULTILEVEL',
			command_get: 'SWITCH_MULTILEVEL_GET',
			command_set: 'SWITCH_MULTILEVEL_SET',
			command_set_parser: (value, node) => {
				// Setting on/off state when dimming
				if (typeof node.state.onoff === 'undefined' || node.state.onoff !== (value > 0)) {
					node.state.onoff = value > 0;
					module.exports.realtime(node.device_data, 'onoff', value > 0);
				}
				return {
					Value: Math.round(value * 99),
				};
			},
			command_report: 'SWITCH_MULTILEVEL_REPORT',
			command_report_parser: (report, node) => {
				if (!report) return null;
				if (typeof report.Value === 'string') {
					if (typeof node.state.onoff === 'undefined' || node.state.onoff !== (report.Value === 'on/enable')) {
						node.state.onoff = report.Value === 'on/enable';
						module.exports.realtime(node.device_data, 'onoff', report.Value === 'on/enable');
					}
					return (report.Value === 'on/enable') ? 1.0 : 0.0;
				}
				if (typeof report['Value (Raw)'] !== 'undefined') {
					if (!node.state.onoff || node.state.onoff !== (report['Value (Raw)'][0] > 0)) {
						node.state.onoff = report['Value (Raw)'][0] > 0;
						module.exports.realtime(node.device_data, 'onoff', report['Value (Raw)'][0] > 0);
					}
					return report['Value (Raw)'][0] / 99;
				}
				return null;
			},
			pollInterval: 'poll_interval',
		},
	},

	beforeInit: (token, callback) => {
		const node = module.exports.nodes[token];
		if (node) {
			if (!singlePress.hasOwnProperty(node.device_data.token)) {
				singlePress[node.device_data.token] = false;
			}
		}

		// Initiate the device
		return callback();
	},

	settings: {
		led_behaviour: {
			index: 3,
			size: 1,
		},
		invert_switch: {
			index: 4,
			size: 1,
		},
		led_behaviour_data: {
			index: 19,
			size: 1,
		},
	},
});

module.exports.on('initNode', token => {
	const node = module.exports.nodes[token];

	if (node) {
		node.instance.on('applicationUpdate', () => {
			setTimeout(() => {
				node.instance.CommandClass.COMMAND_CLASS_SWITCH_MULTILEVEL.SWITCH_MULTILEVEL_GET();
			}, 2500);

			if (singlePress.hasOwnProperty(token)) {
				singlePress[token] = true;
				setTimeout(() => {
					singlePress[token] = false;
				}, 200);
			}
		});

		// Trigger on BASIC_SET
		if (node.instance.CommandClass.COMMAND_CLASS_BASIC !== 'undefined') {
			node.instance.CommandClass.COMMAND_CLASS_BASIC.on('report', (command, report) => {

				if (command.name === 'BASIC_SET') {
					// Single press registered
					if (singlePress[token] === true) {
						// Trigger Single click on flow card
						if (report.Value === 255) Homey.manager('flow').triggerDevice('TZ65D_s2_single_on', null, null, node.device_data);

						// Trigger Single click off flow card
						if (report.Value === 0) Homey.manager('flow').triggerDevice('TZ65D_s2_single_off', null, null, node.device_data);
					}

					// Double press registered
					else if (singlePress[token] === false) {
						// Trigger Double click on flow card
						if (report.Value === 255) Homey.manager('flow').triggerDevice('TZ65D_s2_double_on', null, null, node.device_data);

						// Trigger Double click off flow card
						if (report.Value === 0) Homey.manager('flow').triggerDevice('TZ65D_s2_double_off', null, null, node.device_data);
					}
				}
			});
		}
	}
});