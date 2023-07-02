console.log("-----------");
console.log("SERVER STARTED !");
console.log("-----------");

const { MongoClient } = require('mongodb');
const axios = require("axios");
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');
const cookieParser = require("cookie-parser");
const url = 'mongodb://localhost:27017';
const client = new MongoClient(url);
const fs = require("fs");
const AdmZip = require("adm-zip");
const { engine } = require('express-handlebars');
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.engine('handlebars', engine());
app.set('view engine', 'handlebars');
app.set('views', './view');
app.use(cookieParser());
app.use(session({secret:'wifivjdjdhneh343jdifd9a3j3rjkfef9dhhwkcmym5mdl',saveUninitialized:true,resave:true}));
app.use(express.json());

(async function connect_to_db()
{
await client.connect();
db = client.db('VPN_PANEL');
panels = db.collection('panels');
marzbans = db.collection('marzbans');
})();

function gri(min,max) 
{
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function e2p(num)
{
	var persian_numbers = ["۰","۱","۲","۳","۴","۵","۶","۷","۸","۹"];
	return num.toString().replace(/\d/g,function(i){ return persian_numbers[i]});
}

async function insert_to_db(obj) { await panels.insertOne(obj);return "DONE"; }
async function get_panels() {const result = await panels.find().toArray();return result;}
async function get_panels_light() {const result = await panels.find({},{accounts:0}).toArray();return result;}
async function get_panel(id) {const result = await panels.find({id:id}).toArray();return result[0];}
async function get_panel_light(id) {const result = await panels.find({id:id},{accounts:0}).toArray();return result[0];}
async function update_panel(id,value) {await panels.updateOne({id:id},{$set:value},function(){});return "DONE";}

async function insert_to_db2(obj) { await marzbans.insertOne(obj);return "DONE"; }
async function get_marzbans() {const result = await marzbans.find().toArray();return result;}
async function get_marzban(id) {const result = await marzbans.find({id:id}).toArray();return result[0];}
async function update_marzban(id,value) {await marzbans.updateOne({id:id},{$set:value},function(){});return "DONE";}

function data_usage_converter(num) 
{
	return parseFloat((num/10**9).toFixed(1));
}



async function execute_db_cursor()
{

	try
	{
			var panels = await get_panels();
			var marzbans = await get_marzbans();
			var marzban_users = [];

			for(var i=0;i<panels.length;i++)
			{
				var accounts = panels[i].accounts;
				var used_data = 0;

				for(var j=0;j<panels[i].accounts.length;j++)
				{
					var used_traffic = 0;
					var corresponding_marzban = await get_marzban(panels[i].accounts[j].marzban_id);

					const auth = 
					{
						'username' : corresponding_marzban.username,
						'password' : corresponding_marzban.password
					};

					const headers =
					{
						'accept': 'application/json',
						'Content-Type': 'application/x-www-form-urlencoded'
					};

					var auth_res = 
					{
						'accept': 'application/json',
						'Authorization':'',
						'Content-Type': 'application/json'
					};
					
					var link = corresponding_marzban['link'].matchAll(/(.*)\/dashboard/g);for(k of link) link = k[1];
					var api_auth_res = (await axios.post(link+'/api/admin/token',auth,{headers:headers})).data;
					auth_res['Authorization'] = api_auth_res['token_type'] + ' ' + api_auth_res['access_token'];
					var vpn_user_data =  (await axios({method: 'GET',url: link+'/api/user/'+panels[i].accounts[j].username,headers:auth_res})).data;
					used_data += vpn_user_data['used_traffic'];
					accounts[j]['data_used'] = data_usage_converter(vpn_user_data['used_traffic']);
			
					if(accounts[j].days==0) accounts[j].status = 2;

					console.log();
				}

				var res = await update_panel(panels[i].id,{accounts:accounts,used_data:data_usage_converter(used_data)});
			}



			for(var i=0;i<marzbans.length;i++)
			{
				var link = marzbans[i]['link'].matchAll(/(.*)\/dashboard/g);for(k of link) link = k[1];

					const auth = 
					{
						'username' : marzbans[i]['username'],
						'password' : marzbans[i]['password']
					};

					const headers =
					{
						'accept': 'application/json',
						'Content-Type': 'application/x-www-form-urlencoded'
					};

					var auth_res = 
					{
						'accept': 'application/json',
						'Authorization':'',
						'Content-Type': 'application/json'
					};

					var api_auth_res = (await axios.post(link+'/api/admin/token',auth,{headers:headers})).data;
					auth_res['Authorization'] = api_auth_res['token_type'] + ' ' + api_auth_res['access_token'];
					var api_system_res = (await axios({method: 'GET',url: link+'/api/system/',headers:auth_res})).data;

					// SYNC
					var api_users_arr = (await axios({method: 'GET',url: link+'/api/users/',headers:auth_res})).data.users;
					for(var k=0;k<api_users_arr.length;k++)
					{
						api_users_arr[k].link = link;
						api_users_arr[k].marzban_id = marzbans[i]['id'];
						api_users_arr[k].country = marzbans[i]['country'];
						
					}

					//marzban_users = [...new Set(marzban_users)];
					marzban_users = marzban_users.filter((value, index, self) => index === self.findIndex((t) => (t.place === value.place && t.name === value.name)))
					marzban_users = marzban_users.concat(api_users_arr);

					await update_marzban(marzbans[i].id,{users_active:api_system_res['users_active'],current_users:api_system_res['total_user'],data_usage:data_usage_converter(api_system_res['incoming_bandwidth'] + api_system_res['outgoing_bandwidth'])})
					
			}

			//SYNC
			for(var i=0;i<panels.length;i++)
			{
				var accounts = panels[i].accounts;
				var accounts_name = [];
				
				for(var k=0;k<accounts.length;k++) accounts_name.push(accounts[k].username);

				for(var j=0;j<marzban_users.length;j++)
				{
					if(marzban_users[j].username.startsWith(panels[i].prefix+"_") && !accounts_name.includes(marzban_users[j].username) )
					{
						// LINKED WITH ===> add_user event
						accounts.push({
						username:marzban_users[j].username,
						data_limit:parseFloat((marzban_users[j].data_limit/1073741824).toFixed(2)),
						days:Math.floor((marzban_users[j].expire - Date.now()/1000)/86400),
						country:marzban_users[j].country,
						data_used:data_usage_converter(marzban_users[j].used_traffic),
						id:gri(100000,999999),
						uid:uuidv4(),
						url:marzban_users[j].link + marzban_users[j].subscription_url,
						link:marzban_users[j].links.join("\n"),
						marzban_id:marzban_users[j].marzban_id,
						status:marzban_users[j].status=='active'?1:0,
						suspended_days:0,
						created_at:Date.now()
						});
					}
				}
				var res = await update_panel(panels[i].id,{accounts:accounts});

			}
			

		var date = new Date();
		console.log( date.toLocaleTimeString() + " ---> MAIN CURSOR DONE ");
	}

	catch(err)
	{
		var date = new Date();
		console.log( date.toLocaleTimeString() + " ---> MAIN CURSOR ERROR " + err );
	}
}

async function days_minus_one()
{

	try
	{
		var panels = await get_panels();

		for(var i=0;i<panels.length;i++)
		{
			var accounts = panels[i].accounts;

			for(var j=0;j<panels[i].accounts.length;j++)
			{
				if(accounts[j].days && accounts[j].status == 1) accounts[j].days = accounts[j].days - 1;
				else accounts[j].suspended_days = accounts[j].suspended_days + 1;

				if(accounts[j].suspended_days == 7)
				{
				
					var marzban_data = await get_marzban(accounts[j].marzban_id);

					const auth = 
					{
					'username' : marzban_data['username'],
					'password' : marzban_data['password']
					};

					const headers =
					{
					'accept': 'application/json',
					'Content-Type': 'application/x-www-form-urlencoded'
					};

					var auth_res = 
					{
					'accept': 'application/json',
					'Authorization':'',
					'Content-Type': 'application/json'
					};


					var ip = marzban_data['link'].matchAll(/(.*)\/dashboard/g);
					for(l of ip) ip = l[1];



						var link1 = ip+"/api/admin/token";
						var link2 = ip+"/api/user/"+accounts[j]['username'];
						accounts.splice(j,1);

						var response = await axios.post(link1,auth,{headers:headers});
						auth_res['Authorization'] = response.data['token_type'] + ' ' + response.data['access_token'];
						var response_2 = await axios({method: 'DELETE',url: link2,headers:auth_res});
						console.log(response_2);

			
				}

			}

			var res = await update_panel(panels[i].id,{accounts:accounts});
		}

		var date = new Date();
		console.log( date.toLocaleTimeString() + " ---> DAYS CURSOR DONE ");
	}

	catch(err)
	{
		var date = new Date();
		console.log( date.toLocaleTimeString() + " ---> DAYS CURSOR ERROR " + err );
	}


}


async function is_the_name_taken(str)
{
	var panels = await get_panels();
	var names = [];

	for(var i=0;i<panels.length;i++)
	{
		for(var j=0;j<panels[i].accounts.length;j++)
		{
		names.push(panels[i].accounts[j].username);
		}
	}

		if(names.includes(str)) return false;
		else return true;

}

setInterval(function()
{
execute_db_cursor();
},60000);


var now = new Date();
var time_left_to_run_cron = new Date(now.getFullYear(),now.getMonth(),now.getDate(),0,0,0,0) - now;
if (time_left_to_run_cron < 0) 
{
	time_left_to_run_cron += 86400000;
}

setTimeout(days_minus_one,time_left_to_run_cron);


app.get("/admin",(req,res) => 
{

	if( !req.session.privilage || req.session.privilage == 1 ) res.redirect("/login");

	else
	{

		get_marzbans().then(marzbans_obj =>
		{
			get_panels_light().then(panels_obj =>
			{

			var available_countries = []

			for(var i=0;i<marzbans_obj.length;i++)
			{
				available_countries.push(marzbans_obj[i].country);
			}


			data = 
			{
			layout:false,
			"panels_obj":panels_obj,
			"marzbans_obj":marzbans_obj,
			"available_countries":JSON.stringify(available_countries)
			};

			res.render("index",data);
			});
		});

	}

});

app.get("/panel",(req,res) => 
{
	if( !req.session.privilage || req.session.privilage == 2 ) res.redirect("/login");
	
	else
	{
		var panel_id = req.session.panel_id;

		get_panel(panel_id).then(panel_obj =>
		{
			get_marzbans().then(marzbans_obj =>
			{
				var accounts_count = panel_obj.accounts.length;
				var acc_len = Math.floor(panel_obj.accounts.length/10) + 1;
				var marzbans_obj_sent = {};

				for(var i=0;i<marzbans_obj.length;i++)
				{
					var ip = marzbans_obj[i].link.matchAll(/(.*)\/dashboard/g);
					for(j of ip) ip = j[1];
					marzbans_obj_sent[marzbans_obj[i].id] = ip;
				}

				panel_obj.accounts = panel_obj.accounts.slice(0,10);

				data = 
				{
					layout:false,
					panel_obj_start:JSON.stringify(panel_obj),
					marzban_obj_start:JSON.stringify(marzbans_obj_sent),
					pages_number:acc_len,
					accounts_count:accounts_count,
					panel_id:panel_id
				};
		
				res.render("panel",data);
			});
		});
	}


});

app.get("/login",(req,res) => 
{

req.session.privilage = 0;
req.session.save();

	data = 
	{
	layout:false
	};

	res.render("login",data);
});

app.get("/dldb", async (req,res) => 
{

	if( !req.session.privilage || req.session.privilage == 1 ) res.redirect("/login");

	else
	{
		var panels = await get_panels();
		var marzbans = await get_marzbans();
		await fs.promises.writeFile("dbdl/panels.json",JSON.stringify(panels));
		await fs.promises.writeFile("dbdl/marzbans.json",JSON.stringify(marzbans));
		var zip = new AdmZip();
		zip.addLocalFile(__dirname + "/dbdl/panels.json");
		zip.addLocalFile(__dirname + "/dbdl/marzbans.json");
		var willSendthis = zip.toBuffer();
		zip.writeZip(__dirname + "/dbdl/db.zip");
		res.download( __dirname + "/dbdl/db.zip");
	}

});


app.post("/validate_login",(req,res) =>
{

	var username = req.body.username;
	var password = req.body.password;

			//if(username=='admin' && password=='admin')
			if(username=='mahdimf1@gmail.com' && password=='mahdi2020')
			{
				req.session.privilage = 2;
				req.session.save();
				res.send('2');
			}

			else
			{

				get_panels().then(panels_data =>
				{
					for(var i=0;i<panels_data.length;i++)
					{
						if(username==panels_data[i].username && password==panels_data[i].password)
						{
						req.session.privilage = 1;
						req.session.panel_id = panels_data[i].id;
						req.session.save();
						break;
						}
					}

				if(!req.session.privilage) res.send('0');
				else res.send('1');

				});
			}



});


io.on('connection', (socket) => 
{

// -----------ADMIN EVENTS-----------

	socket.on("add_panel", (name) => 
	{
		insert_to_db({"id":gri(100000,999999),"name":name,username:"root",password:"admin",data_size:0,used_data:0,max_days:30,country:"",prefix:"",created_at:Date.now(),accounts:[]}).then( () =>
		{
			get_panels_light().then(panels_obj =>
			{
			socket.emit("add_panel_done",panels_obj);
			});
		});
	});

	socket.on("fetch_panel", (id) => 
	{
		get_panel_light(Number(id)).then(panel_data =>
		{
			socket.emit("fetch_panel_done",panel_data);
		});
	
	});

	socket.on("save_changes", (data) => 
	{
		update_panel(Number(data["id"]),{name:data["name"],data_size:Number(data["data_size"]),username:data["username"],password:data["password"],country:data["country"],prefix:data["prefix"],max_days:Number(data["max_days"])}).then((res) =>
		{
			get_panels().then(panels_obj =>
			{
				socket.emit("add_panel_done",panels_obj);
				socket.emit("save_changes_done","DONE");
			});
		});
	
	});


	socket.on("save_marzban", (marzban) => 
	{
	
		var connection_status = 0;
		var current_users = 0;
		var ip = marzban["marzban_link"].matchAll(/(.*)\/dashboard/g);
		for(i of ip) ip = i[1];
		var link = ip+"/api/admin/token";
		var link2 = ip+"/api/system";
		var data_usage = "-";
		var users_active = 0;

		const auth = 
		{
		'username' : marzban["marzban_username"],
		'password' : marzban["marzban_password"]
		};

		const headers =
		{
		'accept': 'application/json',
		'Content-Type': 'application/x-www-form-urlencoded'
		};

		var auth_res = 
		{
		'accept': 'application/json',
		'Authorization':'',
		'Content-Type': 'application/json'
		};

		axios.post(link,auth,{headers:headers})
		.then(response =>
		{
		connection_status = 1;
		auth_res['Authorization'] = response.data['token_type'] + ' ' + response.data['access_token'];

		

		})
		.catch(err=>connection_status = 0)
		.finally(() =>
		{

			if(connection_status==1)
			{
				axios({method: 'get',url: link2,headers:auth_res}).then(res=>
				{
				current_users = res.data['total_user'];
				users_active = res.data['total_user'];
				data_usage = data_usage_converter(res.data['incoming_bandwidth'] + res.data['outgoing_bandwidth']);
				insert_to_marzban();
				})
			}
			
			else
			{
			insert_to_marzban();
			}

			function insert_to_marzban()
			{
				insert_to_db2({"id":gri(100000,999999),"name":marzban["marzban_name"],"username":marzban["marzban_username"],"password":marzban["marzban_password"],"max_users":Number(marzban["marzban_max_users"]),"current_users":current_users,"country":marzban["marzban_country"],"link":marzban["marzban_link"],"connected":connection_status,users_active:users_active,data_usage:data_usage,created_at:Date.now()}).then( () =>
				{
					get_marzbans().then(marzbans =>
					{
					socket.emit("save_marzban_done",marzbans);
					});
				});
			}
		});
	});

	socket.on("update_marzban", (marzban) => 
	{
		var connection_status = 0;
		var current_users = 0;
		var ip = marzban["marzban_link"].matchAll(/(.*)\/dashboard/g);
		for(i of ip) ip = i[1];
		
		var link = ip+"/api/admin/token";
		var link2 = ip+"/api/system";
		var data_usage = "-";
		var users_active = 0;

		const auth = 
		{
		'username' : marzban["marzban_username"],
		'password' : marzban["marzban_password"]
		};

		const headers =
		{
		'accept': 'application/json',
		'Content-Type': 'application/x-www-form-urlencoded'
		};

		var auth_res = 
		{
		'accept': 'application/json',
		'Authorization':'',
		'Content-Type': 'application/json'
		};

		axios.post(link,auth,{headers:headers})
		.then(response =>
		{
		connection_status = 1;
		auth_res['Authorization'] = response.data['token_type'] + ' ' + response.data['access_token'];
		})
		.catch(err=>connection_status = 0)
		.finally(() =>
		{
	
			if(connection_status==1)
			{
				axios({method: 'get',url: link2,headers:auth_res}).then(res=>
				{
				current_users = res.data['total_user'];
				users_active = res.data['total_user'];
				data_usage = data_usage_converter(res.data['incoming_bandwidth'] + res.data['outgoing_bandwidth']);
				update_marzban_collection();
				})
			}
			
			else
			{
			update_marzban_collection();
			}

			function update_marzban_collection()
			{
				update_marzban(marzban["id"],{"name":marzban["marzban_name"],"username":marzban["marzban_username"],"password":marzban["marzban_password"],"max_users":Number(marzban["marzban_max_users"]),"country":marzban["marzban_country"],"link":marzban["marzban_link"],"connected":connection_status,"current_users":current_users,users_active:users_active,data_usage:data_usage}).then( () =>
				{
					get_marzbans().then(marzbans =>
					{
					socket.emit("update_marzban_done",marzbans);
					});
				});
			}
		});






	});

	socket.on("fetch_marzban", (id) => 
	{
		get_marzban(id).then(marzban_data =>
		{
		socket.emit("fetch_marzban_done",marzban_data);
		});
	
	});

	socket.on("delete_panel", async (id)=>
	{
		await panels.deleteOne({id:id},function(){});

		get_panels().then(panels_obj =>
		{
			socket.emit("delete_panel_done");
			socket.emit("add_panel_done",panels_obj);
		});

	});


	socket.on("dmp", async (id)=>
	{
		await marzbans.deleteOne({id:id},function(){});

		get_marzbans().then(marzbans =>
		{
			socket.emit("update_marzban_done",marzbans);
		});

	});


// -----------PANEL EVENTS-----------

	socket.on("add_user",(user_data)=>
	{
		var panel_id = user_data["panel_id"];
		var uid = uuidv4();
		get_panel(panel_id).then(panel_data =>
		{
			user_data.account_data.id = gri(100000,999999);
			user_data.account_data.uid = uid;
			if(panel_data.prefix) user_data.account_data.username = panel_data.prefix + "_" + user_data.account_data.username;
			var accounts = panel_data.accounts;
			

			get_marzbans().then(marzbans=>
			{
				selected_marzban_flag = 0;
				marzbans.sort((a,b) => a.created_at - b.created_at);

				for(var i=0;i<marzbans.length;i++)
				{
					if( marzbans[i].current_users < marzbans[i].max_users && marzbans[i].country == user_data.account_data.country )
						{selected_marzban = marzbans[i];selected_marzban_flag = 1;}
				}
				
				if(selected_marzban_flag)
				{
					const auth = 
					{
					'username' : selected_marzban['username'],
					'password' : selected_marzban['password']
					};

					const headers =
					{
					'accept': 'application/json',
					'Content-Type': 'application/x-www-form-urlencoded'
					};

					var auth_res = 
					{
					'accept': 'application/json',
					'Authorization':'',
					'Content-Type': 'application/json'
					};

					var req2_body = 
					{
					"username":user_data.account_data.username,
						"proxies":
						{
						"vmess":{"id":uid},
						"vless":{},
						"trojan":{}
						},
					"inbounds":{},
					"expire":Date.now()/1000 + user_data.account_data.days*86400,
					"data_limit":user_data.account_data.data_limit*1073741824,
					"data_limit_reset_strategy":"no_reset"
					};

					var ip = selected_marzban['link'].matchAll(/(.*)\/dashboard/g);
					for(i of ip) ip = i[1];
					
					var link = ip+"/api/admin/token";
					var link2 = ip+"/api/system";
					var link3 = ip+"/api/user";

					is_the_name_taken(user_data.account_data.username).then(bool_res =>
					{
						axios.post(link,auth,{headers:headers}).then(response =>
						{

								if(!bool_res) throw "نام مورد نظر قبلا استفاده شده است";
								if(panel_data.data_size - user_data.account_data.data_limit<0) throw "حجم کافی ندارید";
								if(user_data.account_data.days>panel_data.max_days) throw "تعداد روز بیشتر از " + e2p(panel_data.max_days) + " نمی تواند باشد";

								auth_res['Authorization'] = response.data['token_type'] + ' ' + response.data['access_token'];

								axios({
								method: 'POST',
								url: link3,
								headers:auth_res,
								data: req2_body
								}).then(res =>
								{

									user_data.account_data.url = ip + res.data.subscription_url;
									user_data.account_data.link = res.data.links.join("\n");
									user_data.account_data.marzban_id = selected_marzban['id'];
									user_data.account_data.status = 1;
									user_data.account_data.suspended_days = 0;
									user_data.account_data.created_at = Date.now();

									accounts.push(user_data.account_data);
									update_panel(panel_id,{accounts:accounts,data_size:panel_data.data_size - user_data.account_data.data_limit }).then(res=>
									{
										get_panel(panel_id).then(panel_data_final =>
										{
											panel_data_final.accounts = panel_data_final.accounts.slice((user_data.on_page-1)*10,Math.min((user_data.on_page)*10,panel_data_final.accounts.length));
											socket.emit("add_user_done",panel_data_final);
										});
									});
								});
						}).catch(err => socket.emit("err",err));
					});
				}
				
				else
				{
					socket.emit("err","عملیات ناموفق بود");
				}
			});


		});
	});

	socket.on("get_vpn",(vpn_obj)=>
	{
		get_panel(vpn_obj["panel_id"]).then(panel_obj=>
		{
			var accounts = panel_obj['accounts'];
			var vpn_id = vpn_obj["vpn_id"];
				for(var i=0;i<accounts.length;i++)
				{
					if(accounts[i].id == vpn_id) 
					{
					if(panel_obj['prefix']) accounts[i].username = accounts[i].username.replace(panel_obj['prefix']+"_",'');
					socket.emit("get_vpn_done",accounts[i]);
					}
				}
		});
	});


	socket.on("edit_user",(vpn_obj)=>
	{
		get_panel(vpn_obj["panel_id"]).then(panel_obj=>
		{
			get_marzban(vpn_obj['marzban_edit_id']).then(marzban_data=>
			{
				var accounts = panel_obj['accounts'];
				var vpn_id = vpn_obj["vpn_edit_id"];
				var data_to_change = 0;

				const auth = 
				{
				'username' : marzban_data['username'],
				'password' : marzban_data['password']
				};

				const headers =
				{
				'accept': 'application/json',
				'Content-Type': 'application/x-www-form-urlencoded'
				};

				var auth_res = 
				{
				'accept': 'application/json',
				'Authorization':'',
				'Content-Type': 'application/json'
				};

				var req_body = 
				{
				"username":vpn_obj.account_data.username,
					"proxies":
					{
					"vmess":{"id":"uid"},
					"vless":{},
					"trojan":{}
					},
				"inbounds":{},
				"expire":Date.now()/1000 + vpn_obj.account_data.days*86400,
				"data_limit":vpn_obj.account_data.data_limit*1073741824,
				"data_limit_reset_strategy":"no_reset"
				};

				var ip = marzban_data['link'].matchAll(/(.*)\/dashboard/g);
				for(i of ip) ip = i[1];

					var link1 = ip+"/api/admin/token";
					var link2;


					for(var i=0;i<accounts.length;i++)
					{
							if(accounts[i].id == vpn_id)
							{
							data_to_change = accounts[i].data_limit - vpn_obj.account_data.data_limit;
							accounts[i].username = vpn_obj.account_data.username;
							if(panel_obj['prefix']) accounts[i].username = panel_obj['prefix'] + "_" + accounts[i].username;
							accounts[i].data_limit = vpn_obj.account_data.data_limit;
							accounts[i].days = vpn_obj.account_data.days;
							link2 = ip+"/api/user/"+accounts[i]['username'];
							req_body.proxies.vmess.id = accounts[i].uid;
							break;
							}
					}

					axios.post(link1,auth,{headers:headers}).then(response =>
					{
					if(vpn_obj.account_data.days > panel_obj.max_days ) throw "تعداد روز بیشتر از " + e2p( panel_obj.max_days ) + " نمی تواند باشد";
					auth_res['Authorization'] = response.data['token_type'] + ' ' + response.data['access_token'];

						axios({
						method: 'PUT',
						url: link2,
						headers:auth_res,
						data: req_body
						}).then(res =>
						{
							update_panel(vpn_obj["panel_id"],{accounts:accounts,data_size:panel_obj['data_size'] + data_to_change }).then(res=>
							{
								get_panel(vpn_obj["panel_id"]).then(panel_obj_final=>
								{
									panel_obj_final.accounts = panel_obj_final.accounts.slice((vpn_obj.on_page-1)*10,Math.min((vpn_obj.on_page)*10,panel_obj_final.accounts.length));
									socket.emit("edit_user_done",panel_obj_final);
								});
							});
						});
					}).catch(err => socket.emit("err",err));
			});
		});
	});



	socket.on("delete_vpn",(vpn_obj)=>
	{
		var panel_id = vpn_obj['panel_id'];
		var marzban_id = vpn_obj['marzban_id'];

		get_panel(panel_id).then(panel_data =>
		{
			get_marzban(marzban_id).then(marzban_data=>
			{

				const auth = 
				{
				'username' : marzban_data['username'],
				'password' : marzban_data['password']
				};

				const headers =
				{
				'accept': 'application/json',
				'Content-Type': 'application/x-www-form-urlencoded'
				};

				var auth_res = 
				{
				'accept': 'application/json',
				'Authorization':'',
				'Content-Type': 'application/json'
				};


				var ip = marzban_data['link'].matchAll(/(.*)\/dashboard/g);
				for(i of ip) ip = i[1];
				
				

				var accounts = panel_data.accounts;
				var data_size_to_add = 0;
				var data_size = panel_data.data_size;
				var deleted_account = {};

					for(var i=0;i<accounts.length;i++)
					{
						if(accounts[i].id == vpn_obj['id']) 
						{
							data_size_to_add = accounts[i].data_limit - accounts[i].data_used;
							deleted_account = accounts[i];
							accounts.splice(i,1);
						}
					}

					var link1 = ip+"/api/admin/token";
					var link2 = ip+"/api/user/"+deleted_account['username'];

					axios.post(link1,auth,{headers:headers}).then(response =>
					{

					auth_res['Authorization'] = response.data['token_type'] + ' ' + response.data['access_token'];

						axios({
						method: 'DELETE',
						url: link2,
						headers:auth_res
						}).then(res =>
						{
							update_panel(panel_id,{accounts:accounts,data_size:data_size + data_size_to_add}).then(res=>
							{
								get_panel(panel_id).then(panel_data_final =>
								{
									panel_data_final.accounts = panel_data_final.accounts.slice((vpn_obj.on_page-1)*10,Math.min((vpn_obj.on_page)*10,panel_data_final.accounts.length));
									socket.emit("delete_vpn_done",panel_data_final);
								});
							});
						});
					}).catch(err => socket.emit("err","خطا"));
			});
		});
	});


	socket.on("reset_vpn",(vpn_obj)=>
	{
		var panel_id = vpn_obj['panel_id'];
		var marzban_id = vpn_obj['marzban_id'];

		get_panel(panel_id).then(panel_data =>
		{
			get_marzban(marzban_id).then(marzban_data=>
			{

				const auth = 
				{
				'username' : marzban_data['username'],
				'password' : marzban_data['password']
				};

				const headers =
				{
				'accept': 'application/json',
				'Content-Type': 'application/x-www-form-urlencoded'
				};

				var auth_res = 
				{
				'accept': 'application/json',
				'Authorization':'',
				'Content-Type': 'application/json'
				};


				var ip = marzban_data['link'].matchAll(/(.*)\/dashboard/g);
				for(i of ip) ip = i[1];
				
				
				var data_size = panel_data.data_size;
				var accounts = panel_data.accounts;
				var edited_account = {};

					for(var i=0;i<accounts.length;i++)
					{
						if(accounts[i].id == vpn_obj['id']) 
						{
						edited_account = accounts[i];
						data_size = data_size - accounts[i].data_used;
						accounts[i].data_used = 0;
						}
					}

					var link1 = ip+"/api/admin/token";
					var link2 = ip+"/api/user/"+edited_account['username']+"/reset";

					axios.post(link1,auth,{headers:headers}).then(response =>
					{

					auth_res['Authorization'] = response.data['token_type'] + ' ' + response.data['access_token'];

						axios({
						method: 'POST',
						url: link2,
						headers:auth_res
						}).then(res =>
						{
							update_panel(panel_id,{accounts:accounts,data_size:data_size}).then(res=>
							{
								get_panel(panel_id).then(panel_data_final =>
								{
									panel_data_final.accounts = panel_data_final.accounts.slice((vpn_obj.on_page-1)*10,Math.min((vpn_obj.on_page)*10,panel_data_final.accounts.length));
									socket.emit("reset_vpn_done",panel_data_final);
								});
							});
						});
					}).catch(err => socket.emit("err","خطا"));
			});
		});
	});



	socket.on("toggle_vpn",(vpn_obj)=>
	{
		var panel_id = vpn_obj['panel_id'];
		var marzban_id = vpn_obj['marzban_id'];

		get_panel(panel_id).then(panel_data =>
		{
			get_marzban(marzban_id).then(marzban_data=>
			{

				const auth = 
				{
				'username' : marzban_data['username'],
				'password' : marzban_data['password']
				};

				const headers =
				{
				'accept': 'application/json',
				'Content-Type': 'application/x-www-form-urlencoded'
				};

				var auth_res = 
				{
				'accept': 'application/json',
				'Authorization':'',
				'Content-Type': 'application/json'
				};


				var req_body = 
				{
				"status": "active"
				};


				var ip = marzban_data['link'].matchAll(/(.*)\/dashboard/g);
				for(i of ip) ip = i[1];
				
				
				var accounts = panel_data.accounts;
				var edited_account = {};

					for(var i=0;i<accounts.length;i++)
					{
						if(accounts[i].id == vpn_obj['id']) 
						{
						edited_account = accounts[i];
						accounts[i].status ^= 1;
						if(!accounts[i].status) req_body.status = "disabled";
						}
					}

					var link1 = ip+"/api/admin/token";
					var link2 = ip+"/api/user/"+edited_account['username'];

					axios.post(link1,auth,{headers:headers}).then(response =>
					{

					auth_res['Authorization'] = response.data['token_type'] + ' ' + response.data['access_token'];

						axios({
						method: 'PUT',
						url: link2,
						headers:auth_res,
						data:req_body
						}).then(res =>
						{
							update_panel(panel_id,{accounts:accounts}).then(res=>
							{
								get_panel(panel_id).then(panel_data_final =>
								{
									panel_data_final.accounts = panel_data_final.accounts.slice((vpn_obj.on_page-1)*10,Math.min((vpn_obj.on_page)*10,panel_data_final.accounts.length));
									socket.emit("toggle_vpn_done",panel_data_final);
								});
							});
						});
					}).catch(err => socket.emit("err","خطا"));
			});
		});
	});

	socket.on("render_page", async (obj) =>
	{
		var res = await get_panel(obj.panel_id);
		res.accounts = res.accounts.slice((obj.on_page-1)*10,Math.min((obj.on_page)*10,res.accounts.length));
		socket.emit("render_page_done",res);
	});


// -----------LOGIN EVENTS-----------

});





server.listen(3000);






