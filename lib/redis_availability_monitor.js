/**
 * This script was developed by Guberni and is part of Tellki's Monitoring Solution
 *
 * March, 2015
 * 
 * Version 1.0
 * 
 * DESCRIPTION: Monitor Redis availability
 *
 * SYNTAX: node redis_availability_monitor.js <METRIC_STATE> <HOST> <PORT> <PASS_WORD>
 * 
 * EXAMPLE: node redis_availability_monitor.js "1,1,1,1" "10.10.2.5" "6379" "username" "password"
 *
 * README:
 *		<METRIC_STATE> is generated internally by Tellki and it's only used by Tellki default monitors: 1 - metric is on; 0 - metric is off
 *		<HOST> redis ip address or hostname
 *		<PORT> redis port
 *		<PASS_WORD> redis password
 */

 var redis = require('redis');
 
/**
 * Metrics.
 */
var metrics = [];
metrics['Status']		= { id: '9999:Status:99' };
metrics['ResponseTime']	= { id: '9999:Response Time:99' };
metrics['Role']			= { id: '9999:Role:99', key : 'role' };
metrics['Uptime']		= { id: '9999:Uptime:99', key : 'uptime_in_seconds' };
 
/**
 * Entry point.
 */
(function() {
	try
	{
		monitorInput(process.argv);
	}
	catch(err)
	{	
		if(err instanceof InvalidParametersNumberError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof InvalidAuthenticationError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof UnknownHostError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else
		{
			console.log(err.message);
			process.exit(1);
		}
	}
}).call(this);

// ############################################################################
// PARSE INPUT

/**
 * Verify number of passed arguments into the script.
 */
function monitorInput(args)
{
	args = args.slice(2);
	if(args.length != 4)
		throw new InvalidParametersNumberError();
	
	monitorInputProcess(args);
}

/**
 * Process the passed arguments and send them to monitor execution.
 * Receive: arguments to be processed
 */
function monitorInputProcess(args)
{
	//<METRIC_STATE>
	var metricState = args[0].replace('"', '');
	var tokens = metricState.split(',');
	var metricsExecution = new Array(7);
	for(var i in tokens)
		metricsExecution[i] = (tokens[i] === '1');
	
	//<HOST> 
	var hostname = args[1];
	
	//<PORT> 
	var port = args[2];
	if (port.length === 0)
		port = '6379';
			
	// <PASS_WORD>
	var passwd = args[3];
	passwd = passwd.length === 0 ? '' : passwd;
	passwd = passwd === '""' ? '' : passwd;
	if(passwd.length === 1 && passwd === '"')
		passwd = '';

	// Create request object to be executed.	
	var request = new Object()
	request.checkMetrics = metricsExecution;
	request.hostname = hostname;
	request.port = port;
	request.passwd = passwd;
	
	// Call monitor.
	monitorRedis(request);
}

// ############################################################################
// GET METRICS

/**
 * Retrieve metrics information
 * Receive: object request containing configuration
 *
 * HTTP request to retrieve data
 * Receive:
 * - request: object containing request configuration
 */
function monitorRedis(request) 
{
	var metricsObj = [];
	
	var ts = new Date();
	var client =  redis.createClient(request.port, request.hostname, {});
	
	if (request.passwd !== '')
	{
		client.auth(request.passwd);
	}

	client.on('connect', function() {
		processInfo(client, metricsObj, ts);
	});

	client.on('error', function (err) {		
		if (err !== undefined && (err.message.indexOf('NOAUTH') != -1 || err.message.indexOf('invalid password') != -1))
		{
			client.quit();
			errorHandler(new InvalidAuthenticationError());
		}
		
		var metric = new Object();
		metric.id = metrics['Status'].id;
		metric.val = '0';
		metricsObj.push(metric);
		
		output(metricsObj);
		client.quit();
		process.exit(0);
	});
}

/**
 *
 */
function processInfo(client, metricsObj, ts)
{	
	ts = (new Date()) - ts;
	
	// Status
	var metric = new Object();
	metric.id = metrics['Status'].id;
	metric.val = '1';
	metricsObj.push(metric);
	
	// Response time
	var metric = new Object();
	metric.id = metrics['ResponseTime'].id;
	metric.val = ts;
	metricsObj.push(metric);

	client.info(function(err, data) {

		var data = parseInfo(data);

		// Role
		var metric = new Object();
		metric.id = metrics['Role'].id;
		metric.val = data['role'] === 'master' ? '1' : '0';
		metricsObj.push(metric);
		
		// Uptime
		var metric = new Object();
		metric.id = metrics['Uptime'].id;
		metric.val = data['uptime_in_seconds'];
		metricsObj.push(metric);
		
		client.quit();
		output(metricsObj);
		process.exit(0);
	});	
}

/**
 *
 */
function parseInfo(info)
{
	var lines = info.split('\r\n');
	var obj = {};
	for (var i = 0, l = info.length; i < l; i++)
	{
		var line = lines[i];
		if (line && line.split)
		{
			line = line.split(':');
			if (line.length > 1)
			{
				var key = line.shift();
				obj[key] = line.join(':');
			}
		}
	}
	return obj;
}

// ############################################################################
// OUTPUT METRICS

/**
 * Send metrics to console
 * Receive: metrics list to output
 */
function output(metrics)
{
	for (var i in metrics)
	{
		var out = "";
		var metric = metrics[i];
		
		out += metric.id;
		out += "|";
		out += metric.val;
		out += "|";
		
		console.log(out);
	}
}

// ############################################################################
// ERROR HANDLER

/**
 * Used to handle errors of async functions
 * Receive: Error/Exception
 */
function errorHandler(err)
{
	if(err instanceof InvalidAuthenticationError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else if(err instanceof UnknownHostError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else if(err instanceof MetricNotFoundError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else if(err instanceof CreateTmpDirError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else if(err instanceof WriteOnTmpFileError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else
	{
		console.log(err.message);
		process.exit(1);
	}
}

// ############################################################################
// EXCEPTIONS

/**
 * Exceptions used in this script.
 */
function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = "Wrong number of parameters.";
	this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;

function InvalidAuthenticationError() {
    this.name = "InvalidAuthenticationError";
    this.message = "Invalid authentication.";
	this.code = 2;
}
InvalidAuthenticationError.prototype = Object.create(Error.prototype);
InvalidAuthenticationError.prototype.constructor = InvalidAuthenticationError;

function UnknownHostError() {
    this.name = "UnknownHostError";
    this.message = "Unknown host.";
	this.code = 26;
}
UnknownHostError.prototype = Object.create(Error.prototype);
UnknownHostError.prototype.constructor = UnknownHostError;

function MetricNotFoundError() {
    this.name = "MetricNotFoundError";
    this.message = "";
	this.code = 8;
}
MetricNotFoundError.prototype = Object.create(Error.prototype);
MetricNotFoundError.prototype.constructor = MetricNotFoundError;
