import CryptoJS from "crypto-js"
import requestConfig from "../config.js"
// 保存jscode到本地
async function setActionflowCode(list = []) {
	const url = (requestConfig?.server_root || "http://localhost") + ":" + (requestConfig?.server_port || 3000) +
		"/writefile";
	let {
		data,
		status,
		msg
	} = await request({
		url,
		data: {
			list
		}
	}, false)
	if (status !== "成功") {
		throw new Error(msg)
	}
	if (!data || data.length <= 0) {
		throw new Error("没有保存任何代码")
	}
	return data;
}
// 获取本地jscode
async function getActionflowCode(actionflow_name, actionflow_dir = "/", actionflow_type = "custom") {
	actionflow_dir = (actionflow_dir || "/");
	const url = (requestConfig?.server_root || "http://localhost") + ":" + (requestConfig?.server_port || 3000) +
		"/readfile";
	let {
		data,
		status,
		msg
	} = await request({
		url,
		data: {
			actionflow_name,
			actionflow_dir,
			actionflow_type
		}
	}, false)
	if (status !== "成功") {
		throw new Error(msg)
	}
	return data;
}

// 获取调试gql
async function get_debug_actionflow_gql(inputs) {
	let {
		actionflow_type = "custom",
			actionflow_name = "test",
			actionflow_dir = "/",
			attach_data = {},
			payload = {},
			args = {}
	} = inputs;

	if (!actionflow_name) {
		throw new Error("actionflow_name不能为空")
	}

	let data = await getActionflowCode(actionflow_name, actionflow_dir, actionflow_type);
	let jscode = data?.[0]?.text
	let gql = "";
	if (actionflow_type == "custom") {
		gql = await get_custom_jscode_gql(jscode, payload, attach_data)

	} else if (actionflow_type == "native") {
		gql = await get_native_jscode_gql(jscode, args)
	}
	return gql;
}
// 执行原生jscode
async function get_native_jscode_gql(jsCode = "", args = {}) {
	// 将代码处理一下，替换一些不合适的文本
	let jsCode_repalce = jsCode.replace(/\\/g, "\\\\").replace(/\r\n/g, "\\n").replace(/\"/g, "\\\"").replace(/\n/g,
		"\\n");
	let gql = `mutation fz_invoke_action_code {
  response: fz_invoke_action_code(
    testPassword: "doushizhutou3"
    args: ${gql_string(args)}
    jsCode: "${jsCode_repalce}"
    updateDb: true
    accountId: 1000000000000001
  )
}`
	return gql;
}

// 执行自定义的jscode
async function get_custom_jscode_gql(jsCode = "", payload = {}, attach_data = {}) {
	let actionflowDir = "",
		actionflowName = "runCustomJscode";
	if (typeof payload != "object") {
		throw new Error("payload格式有误，必须为object")
	}
	if (!payload?.token) {
		payload.token = requestConfig?.token
	}

	let args = {
		actionflow_name: actionflowName,
		payload
	}
	let jsCode_main = `
	let actionflow_name = "${actionflowName}";
	let attach_data = JSON.parse("${JSON.stringify(attach_data)}");
	function main(payload = {}) {
		if (!actionflow_name) {
			return setReturn(payload, "失败", \`actionflow_name:\${actionflow_name},不能为空\`);
		}
		let [system_tmp] = query({
			model: "system",
			limit: 1,
			order_by: {
				id:"desc"
			},
			field_string:\`id name actionflow_id wx_pub_config wx_mini_config wx_union_config actionflow_config attach_config\`
		})
		
		if (system_tmp?.actionflow_id || system_tmp?.actionflow_config?.actionflow_id) {
			system = system_tmp
		} else {
			return setReturn(system_tmp, "失败", \`system表未正确配置，至少需要配置actionflow_id\`);
		}
		
		return (()=>{${jsCode}})();
	}
	`;
	let data = await getActionflowCode("jscode_frame", "/", "frame");
	let jscode_frame = data?.[0]?.text;
	let jscode_res = `
		${jsCode_main}
		${jscode_frame}
		`;

	// 将代码处理一下，替换一些不合适的文本
	let jsCode_repalce = jscode_res.replace(/\\/g, "\\\\").replace(/\r\n/g, "\\n").replace(/\"/g, "\\\"").replace(
		/\n/g,
		"\\n");

	let gql = `mutation fz_invoke_action_code {
  response: fz_invoke_action_code(
    testPassword: "doushizhutou3"
    args: ${gql_string(args)}
    jsCode: "${jsCode_repalce}"
    updateDb: true
    accountId: 1000000000000001
  )
}`
	return gql;
}

function get_mutation_gql(data = {}, mode = 1, response_key = "response") {
	let {
		operation = "",
			field_string = ``,
			where = {},
			_set,
			_inc,
			objects = [], //[]或{}
			object = {},
			args,
			on_conflict,
			pk_columns,
			params,
			id,
	} = data
	let response_body = ``;
	let gql = ``;

	let op_type = operation.slice(0, 6)
	if (op_type != "update" && op_type != "delete" && op_type != "insert" && op_type != "action" && op_type !=
		"umedia") {
		throw new Error("operation不正确，可选值：1.update 2.delete 3.insert 4.action 5.umedia")
	}
	if (op_type == "others") {
		let model = operation.slice(7);
		let params_string = ""
		if (typeof params == "object" && params && Object.keys(params).length > 0) {
			let tempStr = gql_string(params)
			params_string = `${tempStr.slice(1, tempStr.length - 1)}`;
		}
		let queryResponse = "";
		if (field_string) {
			queryResponse = ` {
			  ${field_string}
			}`;
		}
		let queryBody = "";
		if (params_string) {
			queryBody = `(${params_string})`
		}
		response_body = `${response_key}:${model}${queryBody}${queryResponse}`;
		gql = `mutation fz_others { ${response_body} }`;
		return mode === 1 ? gql : (mode === 2 ? response_body : "");
	}
	if (op_type == "action") {
		let actionflow_id = operation.slice(7);
		let args_string = `${gql_string(args||{})}`;
		response_body = `${response_key}: fz_invoke_action_code(
      testPassword: "doushizhutou3"
      args: { actionflow_id: "${actionflow_id}", actionflow_data: ${args_string} }
      jsCode: "const actionflow_data = context.getArg(\\"actionflow_data\\") || {};const actionflow_id = context.getArg(\\"actionflow_id\\") || \\"\\";let action_result = context.callActionFlow(actionflow_id, null, actionflow_data);context.setReturn(\\"action_result\\", action_result);"
      updateDb: true
      accountId: 1000000000000001
    )`
		gql = `mutation fz_action {
      ${response_body}
    }`
		return mode === 1 ? gql : (mode === 2 ? response_body : "");
	}

	if (op_type == "umedia") {
		let media_url = operation.slice(7);
		response_body = `${response_key}: fz_invoke_action_code(
      testPassword: "doushizhutou3"
      args: { media_url: "${media_url}" }
      jsCode: "const media_url = context.getArg(\\"media_url\\") || \\"\\";let umedia_result = context.uploadMedia(media_url, {});context.setReturn(\\"umedia_result\\", umedia_result);"
      updateDb: true
      accountId: 1000000000000001
    )`
		gql = `mutation fz_umedia {
        ${response_body}
      }`
		return mode === 1 ? gql : (mode === 2 ? response_body : "");
	}

	let where_string = "";
	if (typeof where == "object" && where && Object.keys(where).length > 0) {
		where_string = `where:${gql_string(where)}`
	};

	let _set_string = "";
	if (typeof _set == "object" && _set && Object.keys(_set).length > 0) {
		_set_string = `_set:${gql_string(_set)}`
	};

	let _inc_string = "";
	if (typeof _inc == "object" && _inc && Object.keys(_inc).length > 0) {
		_inc_string = `_inc:${gql_string(_inc)}`
	};

	let objects_string = "";
	if (typeof objects == "object" && objects && Object.keys(objects).length > 0) {
		objects_string = `objects:${gql_string(objects, 3)}`
	};

	let on_conflict_string = "";
	if (typeof on_conflict == "object" && on_conflict && Object.keys(on_conflict).length > 0) {
		on_conflict_string = `on_conflict:${gql_string(on_conflict, 3)}`
	};

	let object_string = ""
	if (typeof object == "object" && object && Object.keys(object).length > 0) {
		object_string = `object:${gql_string(object, 3)}`
	}

	let pk_columns_string = ""
	if (typeof pk_columns == "object" && pk_columns && Object.keys(pk_columns).length > 0) {
		pk_columns_string = `pk_columns:${gql_string(pk_columns)}`
	}

	let id_string = ""
	if (typeof id != "undefined") {
		id_string = `id:${id}`
	}

	let responseBodyAutoAttach = "id"
	if (/insert_\w+_one/.test(operation)) {
		response_body = `${response_key}:${operation}(
		  ${object_string}
		  ${on_conflict_string}
		) {
		    ${responseBodyAutoAttach}
		    ${field_string}
		}`
	} else if (/update_\w+_by_pk/.test(operation)) {
		response_body = `${response_key}:${operation}(
		  ${_set_string}
		  ${_inc_string}
		   ${pk_columns_string}
		) {
		    ${responseBodyAutoAttach}
		    ${field_string}
		}`
	} else if (/delete_\w+_by_pk/.test(operation)) {
		response_body = `${response_key}:${operation}(
		  ${id_string}
		) {
		    ${responseBodyAutoAttach}
		    ${field_string}
		}`
	} else {
		response_body = `${response_key}:${operation}(
		  ${where_string}
		  ${_set_string}
		  ${_inc_string}
		  ${objects_string}
		  ${on_conflict_string}
		) {
		  affected_rows
		  returning{
		    ${responseBodyAutoAttach}
		    ${field_string}
		  }
		}`
	}
	gql = `mutation ${operation} {
    ${response_body}
  }`
	return mode === 1 ? gql : (mode === 2 ? response_body : "");
}
// 封装的查询操作，可以直接使用无需再写gql
function get_query_gql(data = {}, mode = 1, response_key = "response") {
	const {
		model = "account", field_string = ``, where = {}, order_by, distinct_on, offset, limit,
			id,
			fz_body, params,
			args
	} = data
	let response_body = ``;
	let gql = ``;

	let args_string = "";
	if (typeof args == "object" && args && Object.keys(args).length > 0) {
		args_string = `args:${gql_string(args)}`;
	}
	let where_string = "";
	if (typeof where == "object" && where && Object.keys(where).length > 0) {
		where_string = `where:${gql_string(where)}`;
	};
	let order_by_string = "";
	if (typeof order_by == "object" && order_by && Object.keys(order_by).length > 0) {
		order_by_string = `order_by:${gql_string(order_by, 2)}`;
	};
	let distinct_on_string = "";
	if (typeof distinct_on == "string" && distinct_on) {
		distinct_on_string = `distinct_on:${distinct_on}`;
	};
	let offset_string = "";
	if (typeof offset == "number" && offset > 0) {
		offset_string = `offset:${offset}`;
	};
	let limit_string = "";
	if (typeof limit == "number" && limit > 0) {
		limit_string = `limit:${limit}`;
	}
	let fz_body_string = ""
	if (typeof fz_body !== "undefined") {
		if (typeof fz_body == "object" && fz_body) {
			fz_body_string = `fz_body:${gql_string(fz_body)}`;
		} else {
			fz_body_string = `fz_body:"${gql_string(fz_body,4)}"`;
		}
	}
	let params_string = ""
	if (typeof params == "object" && params && Object.keys(params).length > 0) {
		let tempStr = gql_string(params)
		params_string = `${tempStr.slice(1, tempStr.length - 1)}`;
	}

	let queryBody = "";
	let responseBodyAutoAttach = ""
	if (/operation_\w+/.test(model)) {
		if (params_string || fz_body_string) {
			queryBody = `(
			  ${params_string}
			  ${fz_body_string}
			) `
		}
	} else if (/\w+_by_pk/.test(model)) {
		if (typeof id != "undefined") {
			queryBody = `(
			  id:${id}
			) `
		}
	} else if (params_string) {
		queryBody = `(
		  ${params_string}
		) `
	} else {
		if (/\w+_aggregate/.test(model)) {
			responseBodyAutoAttach = ""
		} else {
			responseBodyAutoAttach = "id"
		}
		if (where_string || order_by_string || distinct_on_string || offset_string || limit_string || args_string) {
			queryBody = `(
			      ${where_string}
			      ${order_by_string}
			      ${distinct_on_string}
			      ${offset_string}
			      ${limit_string}
				  ${args_string}
			    ) `
		}
	}
	let queryResponse = "";
	if (field_string || responseBodyAutoAttach) {
		queryResponse = `{
			${responseBodyAutoAttach}
			${field_string}
		  }`;
	}
	response_body = `${response_key}: ${model} ${queryBody}${queryResponse}`
	gql = `query ${model} {
    ${response_body}
  }`
	return mode === 1 ? gql : (mode === 2 ? response_body : "");
}

// 获取跨表批处理gql
function get_batch_mutation_gql(list = []) {
	let response_body = ``;
	let gql = ``;
	list.forEach(item => {
		let response_key = item?.response_key || (item?.operation.replace(/[^\w]/g, ""))
		response_body += `${get_mutation_gql(item, 2, response_key)} `
	})
	gql = `mutation batch_mutation{
    ${response_body}
  }`;
	return gql;
}

function get_batch_query_gql(list = []) {
	let response_body = ``;
	let gql = ``;
	list.forEach(item => {
		let response_key = item?.response_key || (item?.model.replace(/[^\w]/g, ""))
		response_body += `${get_query_gql(item, 2, response_key)} `
	})
	gql = `query batch_query{
    ${response_body}
  }`;
	return gql;
}

async function file_reader_change(file, deal_name) {
	let fileRes = await (new Promise((resolve, reject) => {
		// 微信小程序的处理方法
		if (requestConfig?.env == "MP-WEIXIN") {
			wx.getFileSystemManager()[deal_name]({
				filePath: file.path,
				encoding: undefined,
				success: res => {
					let target = {
						result: res.data,
						digest: res.digest
					}
					resolve({
						target
					})
				},
				fail: err => {
					reject(err)
				}
			})
		} else if (requestConfig?.env == "H5") {
			// H5端处理方法
			let reader = new FileReader();
			reader.onload = (onload_info) => {
				resolve(onload_info)
			}
			reader.onerror = (onerror_info) => {
				reject(onerror_info)
			}
			//reader.readAsDataURL(file) // 返回一个基于Base64编码的data-uri对象
			//reader.readAsText(file) // 返回文本字符串。默认情况下，文本编码格式是’UTF-8’，可以通过可选的格式参数，指定其他编码格式的文本
			reader[deal_name](file) // 返回二进制字符串，该字符串每个字节包含一个0到255之间的整数
			//reader.readAsArrayBuffer(Blob|File)//返回一个ArrayBuffer对象
		}
	}))
	return {
		fileRes,
		result: fileRes.target.result,
		digest: fileRes.target.digest,
	}
}

async function get_local_uimage_gql(file) {
	let {
		result: rdRes
	} = await file_reader_change(file, requestConfig?.env == "H5" ? "readAsArrayBuffer" : "readFile");


	let md5Base64, imageSuffix;

	if (requestConfig?.env == "MP-WEIXIN") {
		let {
			digest
		} = await file_reader_change(file, "getFileInfo");

		function hexToArrayBuffer(hexString) {
			// 将16进制字符串转成字节数组
			const byteArray = new Uint8Array(hexString.match(/[\da-f]{2}/gi).map(function(h) {
				return parseInt(h, 16)
			}))
			// 将字节数组转成ArrayBuffer
			return byteArray.buffer
		}
		let digest_ArrayBuffer = hexToArrayBuffer(digest);
		md5Base64 = wx.arrayBufferToBase64(digest_ArrayBuffer);
		imageSuffix = file.path.slice(file.path.lastIndexOf(".") + 1).toUpperCase();

	} else if (requestConfig?.env == "H5") {
		let wordArray = CryptoJS.lib.WordArray.create(rdRes);
		md5Base64 = CryptoJS.enc.Base64.stringify(CryptoJS.MD5(wordArray));
		imageSuffix = file.name.slice(file.name.lastIndexOf(".") + 1).toUpperCase();
	}

	let gql = `mutation ImagePresignedUrl {
	  response:imagePresignedUrl(imageSuffix: ${imageSuffix}, imgMd5Base64:"${md5Base64}") {
	    downloadUrl
	    uploadUrl
	    contentType
	    imageId
	  }
	}`
	return {
		gql,
		md5Base64,
		result: rdRes
	};
}
async function get_local_uvideo_gql(file) {
	let {
		result: rdRes
	} = await file_reader_change(file, requestConfig?.env == "H5" ? "readAsArrayBuffer" : "readFile");


	let md5Base64, videoFormat;
	if (requestConfig?.env == "MP-WEIXIN") {
		let {
			digest
		} = await file_reader_change(file, "getFileInfo");

		function hexToArrayBuffer(hexString) {
			// 将16进制字符串转成字节数组
			const byteArray = new Uint8Array(hexString.match(/[\da-f]{2}/gi).map(function(h) {
				return parseInt(h, 16)
			}))
			// 将字节数组转成ArrayBuffer
			return byteArray.buffer
		}
		let digest_ArrayBuffer = hexToArrayBuffer(digest);
		md5Base64 = wx.arrayBufferToBase64(digest_ArrayBuffer);
		videoFormat = file.path.slice(file.path.lastIndexOf(".") + 1).toUpperCase();
	} else if (requestConfig?.env == "H5") {
		let wordArray = CryptoJS.lib.WordArray.create(rdRes);
		md5Base64 = CryptoJS.enc.Base64.stringify(CryptoJS.MD5(wordArray));
		videoFormat = file.name.slice(file.name.lastIndexOf(".") + 1).toUpperCase();
	}

	let gql = `mutation videoPresignedUrl {
	  response:videoPresignedUrl(videoFormat: ${videoFormat}, videoMd5Base64:"${md5Base64}") {
	    downloadUrl
	    uploadUrl
	    contentType
	    videoId
	  }
	}`
	return {
		gql,
		md5Base64,
		result: rdRes
	};
}
async function get_local_ufile_gql(file) {
	let {
		result: rdRes
	} = await file_reader_change(file, requestConfig?.env == "H5" ? "readAsArrayBuffer" : "readFile");

	let md5Base64, fileSuffix, name;

	if (requestConfig?.env == "MP-WEIXIN") {
		let {
			digest
		} = await file_reader_change(file, "getFileInfo");

		function hexToArrayBuffer(hexString) {
			// 将16进制字符串转成字节数组
			const byteArray = new Uint8Array(hexString.match(/[\da-f]{2}/gi).map(function(h) {
				return parseInt(h, 16)
			}))
			// 将字节数组转成ArrayBuffer
			return byteArray.buffer
		}
		let digest_ArrayBuffer = hexToArrayBuffer(digest);
		md5Base64 = wx.arrayBufferToBase64(digest_ArrayBuffer);
		fileSuffix = file.path.slice(file.path.lastIndexOf(".") + 1).toUpperCase();
		name = file.name || "no-name";

	} else if (requestConfig?.env == "H5") {
		let wordArray = CryptoJS.lib.WordArray.create(rdRes);
		md5Base64 = CryptoJS.enc.Base64.stringify(CryptoJS.MD5(wordArray));
		fileSuffix = file.name.slice(file.name.lastIndexOf(".") + 1).toUpperCase();
		name = file.name

	}
	let format = fileSuffix;
	let gql = `mutation FilePresignedUrl {
	  response:filePresignedUrl(
	    name: "${name}"
	    md5Base64: "${md5Base64}"
	    format: ${format}
	    suffix: "${fileSuffix}"
	  ) {
	    downloadUrl
	    uploadUrl
	    contentType
	    fileId
	  }
	}`
	return {
		gql,
		md5Base64,
		result: rdRes
	};
}
// zion本地上传到阿里云，支持多种类型媒体
async function ali_umedia(file, attach) {
	if (requestConfig?.env == "MP-WEIXIN") {
		if (!file?.path) {
			throw new Error("file.path必须传入")
		}
	} else if (requestConfig?.env == "H5") {
		if (!file?.name) {
			throw new Error("file.name必须传入且必须包含媒体后缀格式")
		}
		// 如果有path但是没有内容说明需要单独获取文件对象
		if (file?.path && !file?.size) {
			file = await fetch(file.path)
				.then(response => response.blob())
				.then(blob => {
					// 在这里将 blob 转为 file 对象
					let file_new = new File([blob], file?.name);
					return file_new
				})
		}
	} else {
		throw new Error("requestConfig.env不支持，仅支持：1.H5 2.MP-WEIXIN")
	}
	let variables = {}
	let {
		url,
		header_authorization,
		type
	} = attach

	let todoRes;
	switch (type) {
		case "uvideo":
			todoRes = get_local_uvideo_gql(file);
			break;
		case "uimage":
			todoRes = get_local_uimage_gql(file);
			break;
		case "ufile":
			todoRes = get_local_ufile_gql(file);
			break;
		default:
			throw new Error(`不支持的type:${type}`)
			break;
	}
	let {
		gql,
		md5Base64,
		result
	} = await todoRes;

	let response = await request({
		url: url || requestConfig?.gql_apiUrl,
		header: {
			authorization: header_authorization || requestConfig?.gql_authorization
		},
		method: "POST",

		data: {
			variables,
			query: gql,
		}
	}).then(res => {
		let response = res?.data?.response
		if (!response) {
			if (typeof res != "string") {
				throw {
					message: "ali_umedia生成上传请求信息失败",
					info: res
				}
			} else {
				throw new Error(res)
			}
		} else {
			return response
		}
	})
	// 上传图片到服务器
	if (requestConfig?.env == "H5") {
		let mediaResult = await fetch(response.uploadUrl, {
			method: 'PUT',
			body: file,
			headers: {
				'Content-Type': response.contentType,
				'Content-MD5': md5Base64,
			},
		});
		if (mediaResult?.status === 200) {
			return response
		} else {
			throw new Error("H5上传媒体资源失败")
		}
	} else if (requestConfig?.env == "MP-WEIXIN") {
		return await new Promise((resolve, reject) => {
			wx.request({
				url: response.uploadUrl,
				data: result,
				method: "PUT",
				header: {
					'Content-Type': response.contentType,
					'Content-MD5': md5Base64,
				},
				success: res => {
					resolve(response)
				},
				fail: e => {
					reject("MP-WEIXIN上传媒体资源失败")
				}
			})
		})
	}
}

// mode=1,仅仅将对象的键的引号替换掉，mode=2，将键和值的引号全部替换掉,默认为模式1，mode=3专门针对带有on_conflict属性的对象进行的替换
function gql_string(obj, mode = 1) {
	if (mode === 1) {
		return JSON.stringify(obj).replace(/"(\w+?)":/g, "$1:");
	} else if (mode === 2) {
		return JSON.stringify(obj).replace(/"/g, "");
	} else if (mode === 3) {
		return JSON.stringify(obj).replace(/"(\w+?)":/g, "$1:").replace(
			/([,\{])update_columns:"([\w,\[\]]+)"([,\}])/g, "$1update_columns:$2$3").replace(
			/([,\{])constraint:"([\w,\[\]]+)"([,\}])/g, "$1constraint:$2$3")
	} else if (mode === 4) {
		return obj.replace(/\\/g, "\\\\").replace(/\r\n/g, "\\n").replace(/\"/g, "\\\"").replace(/\n/g, "\\n");
	}
}

// 封装请求函数,仅支持普通的json请求
async function request(options, isClog) {
	if (isClog !== false) {
		if (requestConfig?.env == "H5") {
			typeof process != "undefined" && process?.env?.NODE_ENV !== 'production' && console.log(
				"%crequest发起请求传入options：",
				"color: #c5c500", options);
		} else if (requestConfig?.env == "MP-WEIXIN") {
			console.log("request发起请求传入options：", options);
		}
	}

	options.method = (options?.method || "POST");
	let response = await new Promise((resolve, reject) => {
		if (requestConfig?.env == "MP-WEIXIN") {
			options.success = res => {
				resolve(res.data)
			}
			options.fail = e => {
				reject(e)
			}
			wx.request(options)
		} else if (requestConfig?.env == "H5") {
			fetch(options.url, {
				method: options?.method,
				body: JSON.stringify(options?.data),
				headers: {
					...options?.header,
					'Content-Type': 'application/json'
				},
			}).then(res => {
				resolve(res.json())
			}).catch(e => {
				reject(e)
			});
		}
	})
	if (isClog !== false) {
		if (requestConfig?.env == "H5") {
			typeof process != "undefined" && process?.env?.NODE_ENV !== 'production' && console.log(
				"%crequest返回请求结果response：",
				"color: #55aaff", response);
		} else if (requestConfig?.env == "MP-WEIXIN") {
			console.log("request返回请求结果response：", response);
		}
	}
	return response;
}

export default {
	request: async (options, url = "", header_authorization = "") => {
		let variables = options?.variables || {};
		let gql = options?.query;
		if (gql !== undefined) {
			return await request({
				url: url || requestConfig?.gql_apiUrl,
				header: {
					authorization: header_authorization || requestConfig?.gql_authorization
				},
				method: "POST",
				data: {
					variables,
					query: gql,
				}
			}).then(res => {
				let data = res?.data
				if (!data) {
					if (typeof res != "string") {
						throw {
							message: "request请求返回有误",
							info: res
						}
					} else {
						throw new Error(res)
					}
				} else {
					return data
				}
			})
		} else {
			return await request(options)
		}
	},
	mutation: async (data, url = "", header_authorization = "") => {
		let variables = {}
		let gql = get_mutation_gql(data)
		return await request({
			url: url || requestConfig?.gql_apiUrl,
			header: {
				authorization: header_authorization || requestConfig?.gql_authorization
			},
			method: "POST",
			data: {
				variables,
				query: gql,
			}
		}).then(res => {
			let response = res?.data?.response
			if (!response) {
				if (typeof res != "string") {
					throw {
						message: "mutation执行失败",
						info: res
					}
				} else {
					throw new Error(res)
				}
			} else {
				return response
			}
		})
	},
	query: async (data, url = "", header_authorization = "") => {
		let variables = {}
		let gql = get_query_gql(data)
		return await request({
			url: url || requestConfig?.gql_apiUrl,
			header: {
				authorization: header_authorization || requestConfig?.gql_authorization
			},
			method: "POST",
			data: {
				variables,
				query: gql,
			}
		}).then(res => {
			let response = res?.data?.response
			if (!response) {
				if (typeof res != "string") {
					throw {
						message: "query执行失败",
						info: res
					}
				} else {
					throw new Error(res)
				}
			} else {
				return response
			}
		})
	},
	batch_mutation: async (list, url = "", header_authorization = "") => {
		let variables = {}
		let gql = get_batch_mutation_gql(list)
		return await request({
			url: url || requestConfig?.gql_apiUrl,
			header: {
				authorization: header_authorization || requestConfig?.gql_authorization
			},
			method: "POST",
			data: {
				variables,
				query: gql,
			}
		}).then(res => {
			let data = res?.data
			if (!data) {
				if (typeof res != "string") {
					throw {
						message: "batch_mutation执行失败",
						info: res
					}
				} else {
					throw new Error(res)
				}
			} else {
				return data
			}
		})
	},
	batch_query: async (list, url = "", header_authorization = "") => {
		let variables = {}
		let gql = get_batch_query_gql(list)
		return await request({
			url: url || requestConfig?.gql_apiUrl,
			header: {
				authorization: header_authorization || requestConfig?.gql_authorization
			},
			method: "POST",
			data: {
				variables,
				query: gql,
			}
		}).then(res => {
			let data = res?.data
			if (!data) {
				if (typeof res != "string") {
					throw {
						message: "batch_query执行失败",
						info: res
					}
				} else {
					throw new Error(res)
				}
			} else {
				return data
			}
		})
	},

	// 执行原生jscode
	runNativeJscode: async (data = {}, url = "", header_authorization = "") => {
		let variables = {}
		let gql = await get_native_jscode_gql(data?.jsCode, data?.args);
		return await request({
			url: url || requestConfig?.gql_apiUrl,
			header: {
				authorization: header_authorization || requestConfig?.gql_authorization
			},
			method: "POST",
			data: {
				variables,
				query: gql,
			}
		}).then(res => {
			let response = res?.data?.response
			if (!response) {
				if (typeof res != "string") {
					throw {
						message: "runNativeJscode执行失败",
						info: res
					}
				} else {
					throw new Error(res)
				}
			} else {
				return response
			}
		})
	},
	// 执行自定义jscode
	runJscode: async (data = {}, url = "", header_authorization = "") => {
		let variables = {};

		if (!data?.payload) {
			data.payload = {
				token: requestConfig?.token
			};
		}
		if (!data?.payload?.token) {
			data.payload.token = requestConfig?.token
		}

		let gql = await get_custom_jscode_gql(data?.jsCode, data?.payload, data?.attach_data);
		return await request({
			url: url || requestConfig?.gql_apiUrl,
			header: {
				authorization: header_authorization || requestConfig?.gql_authorization
			},
			method: "POST",
			data: {
				variables,
				query: gql,
			}
		}).then(res => {
			let response = res?.data?.response
			if (!response) {
				if (typeof res != "string") {
					throw {
						message: "runJscode执行失败",
						info: res
					}
				} else {
					throw new Error(res)
				}
			} else {
				return response
			}
		})
	},
	// 获取自定义行为代码
	getActionflowCode: async (actionflow_name, actionflow_dir = "/", actionflow_type = "custom") => {
		return await getActionflowCode(actionflow_name, actionflow_dir, actionflow_type)
	},
	// 保存自定义行为代码
	setActionflowCode: async (list = []) => {
		return await setActionflowCode(list)
	},
	// 调试自定义行为
	debugActionflow: async (inputs = {}, url = "", header_authorization = "") => {
		let variables = {};
		let gql = await get_debug_actionflow_gql(inputs);
		return await request({
			url: url || requestConfig?.gql_apiUrl,
			header: {
				authorization: header_authorization || requestConfig?.gql_authorization
			},
			method: "POST",
			data: {
				variables,
				query: gql,
			}
		}).then(res => {
			let response = res?.data?.response
			if (!response) {
				if (typeof res != "string") {
					throw {
						message: "debugActionflow执行失败",
						info: res
					}
				} else {
					throw new Error(res)
				}
			} else {
				return response
			}
		})

	},
	// 调用自定义行为
	callActionflow: async (inputs, url = "", header_authorization = "") => {
		let variables = {
			actionflowId: inputs?.actionflowId || requestConfig?.actionflow_id,
			actionflow_name: inputs?.actionflow_name,
			payload: inputs?.payload
		}
		if (!variables?.payload) {
			variables.payload = {
				token: requestConfig?.token
			}
		} else if (!variables?.payload?.token) {
			variables.payload.token = requestConfig?.token
		}

		let gql =
			"mutation fz_action_code($actionflowId:String! $actionflow_name:String! $payload:JsonObject){response:fz_invoke_action_code(testPassword:\"doushizhutou3\" args:{actionflowId:$actionflowId actionflow_name:$actionflow_name payload:$payload}jsCode:\"let actionflow_name=context.getArg(\\\"actionflow_name\\\");let payload = context.getArg(\\\"payload\\\");let actionflowId = context.getArg(\\\"actionflowId\\\"); let {status,msg,data} = context.callActionFlow(actionflowId,null,{actionflow_name,payload});context.setReturn(\\\"status\\\",status);context.setReturn(\\\"msg\\\",msg);context.setReturn(\\\"data\\\",data);\" updateDb:true accountId:1000000000000001)}";
		return await request({
			url: url || requestConfig?.gql_apiUrl,
			header: {
				authorization: header_authorization || requestConfig?.gql_authorization
			},
			method: "POST",
			data: {
				variables,
				query: gql,
			}
		}).then(res => {
			let response = res?.data?.response
			if (!response) {
				if (typeof res != "string") {
					throw {
						message: "callActionflow执行失败",
						info: res
					}
				} else {
					throw new Error(res)
				}
			} else {
				return response
			}
		})
	},
	// 调用原生自定义行为
	callNativeActionflow: async (inputs = {}, url = "", header_authorization = "") => {
		// 资源在外部服务器的公网，公网链接上传
		let variables = {}
		let {
			actionflowId,
			args
		} = inputs;
		if (!actionflowId) {
			throw new Error("actionflowId必须传人")
		}
		let gql = get_mutation_gql({
			operation: `action_${actionflowId}`,
		})
		return await request({
			url: url || requestConfig?.gql_apiUrl,
			header: {
				authorization: header_authorization || requestConfig?.gql_authorization
			},
			method: "POST",
			data: {
				variables,
				query: gql,
			}
		}).then(res => {
			let response = res?.data?.response?.action_result
			if (!response) {
				if (typeof res != "string") {
					throw {
						message: "callNativeActionflow执行失败",
						info: res
					}
				} else {
					throw new Error(res)
				}
			} else {
				return response
			}
		})
	},
	local_uimage: async (fileObj, url = "", header_authorization = "") => {
		// 本地上传，上传图片
		return await ali_umedia(fileObj, {
			type: "uimage",
			url,
			header_authorization
		});
	},
	local_ufile: async (fileObj, url = "", header_authorization = "") => {
		// 本地上传，上传文件
		return await ali_umedia(fileObj, {
			type: "ufile",
			url,
			header_authorization
		});
	},
	local_uvideo: async (fileObj, url = "", header_authorization = "") => {
		// 本地上传，上传视频
		return await ali_umedia(fileObj, {
			type: "uvideo",
			url,
			header_authorization
		});
	},
	outer_umedia: async (media_url, url = "", header_authorization = "") => {
		// 资源在外部服务器的公网，公网链接上传
		let variables = {}
		let gql = get_mutation_gql({
			operation: `umedia_${media_url}`,
		})
		return await request({
			url: url || requestConfig?.gql_apiUrl,
			header: {
				authorization: header_authorization || requestConfig?.gql_authorization
			},
			method: "POST",
			data: {
				variables,
				query: gql,
			}
		}).then(res => {
			let response = res?.data?.response?.umedia_result
			if (!response) {
				if (typeof res != "string") {
					throw {
						message: "outer_umedia上传执行失败",
						info: res
					}
				} else {
					throw new Error(res)
				}
			} else {
				return response
			}
		})
	}
}