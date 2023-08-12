import request from "../client_core/index.js"

// 从本地获取自定义行为jscode更新到服务器
async function updateActionflow(name, actionflow_dir, describe, attach_data, jscode) {
	if (!name) {
		throw new Error("自定义行为name必须传入")
	}
	// 1.本地获取自定义行为代码
	if (!jscode) {
		let data = await request.getActionflowCode(name, actionflow_dir, "custom");
		jscode = data?.[0]?.text;
	}
	// 2.查询自定义行为是否存在
	let [actionflow] = await request.query({
		model: "actionflow",
		where: {
			name: {
				_eq: name
			}
		},
		field_string: "id"
	})
	if (!actionflow) {
		throw new Error("actionflow不存在，请先insertActionflow")
	}

	// 3.修改actionflow
	let u_res = await request.mutation({
		operation: "update_actionflow",
		where: {
			id: {
				_eq: actionflow?.id
			}
		},
		_set: {
			jscode,
			...(actionflow_dir ? {
				actionflow_dir
			} : {}),
			...(describe ? {
				describe
			} : {}),
			...(typeof attach_data == "object" ? {
				attach_data
			} : {})
		},
		field_string: `id jscode name actionflow_dir describe attach_data`
	});
	return u_res;
}
// 从本地获取自定义行为jscode新增到服务器
async function insertActionflow(name, actionflow_dir = "/", describe, attach_data, jscode) {
	if (!name) {
		throw new Error("自定义行为name必须传入")
	}
	actionflow_dir = (actionflow_dir || "/");
	// 1.本地获取自定义行为代码
	if (!jscode) {
		let data = await request.getActionflowCode(name, actionflow_dir, "custom");
		jscode = data?.[0]?.text;
	}


	// 2.查询自定义行为是否存在
	let [actionflow] = await request.query({
		model: "actionflow",
		where: {
			name: {
				_eq: name
			}
		},
		field_string: "id"
	})

	if (actionflow) {
		throw new Error("actionflow已存在，请执行updateActionflow")
	}
	// 添加actionflow
	let i_res = await request.mutation({
		operation: "insert_actionflow",
		objects: [{
			name,
			jscode,
			actionflow_dir,
			...(describe ? {
				describe
			} : {}),
			...(typeof attach_data == "object" ? {
				attach_data
			} : {})
		}],
		field_string: `id jscode name actionflow_dir describe attach_data`
	});
	return i_res;
}

// 将本地的actionflow逐一上传
async function uploadActionflow(name, actionflow_dir, isCover = false) {
	if (!actionflow_dir) {
		throw new Error("请指定要批量上传的文件夹路径actionflow_dir")
	}
	if (actionflow_dir.slice(0, 1) != "/" || actionflow_dir.slice(-1) != "/") {
		throw new Error(`actionflow_dir必须以【/】开头和结尾`);
	}
	let data = await request.getActionflowCode(name, actionflow_dir, "custom");
	if (data.length <= 0) {
		throw new Error(`本地actionflow在该actionflow_dir下暂无对应内容`);
	}
	let actionflow_lists = await request.query({
		where: {
			...(name ? {
				name: {
					_eq: name
				}
			} : {})
		},
		model: "actionflow",
		field_string: `id name`
	})

	let batch_mutations = [];
	let field_string = `id name actionflow_dir describe attach_data`;

	let actionflow_objects = [];

	data.forEach((item, index) => {
		// 如果不需要覆盖，并且已经存在则进行更新
		let findActionflow = actionflow_lists.find(item_a => item_a?.name == item?.name);
		if (findActionflow) {
			if (isCover) {
				batch_mutations.push({
					response_key: `update_actionflow_${index}_${findActionflow.id}`,
					operation: "update_actionflow",
					where: {
						id: {
							_eq: findActionflow.id
						}
					},
					_set: {
						jscode: item?.text,
						actionflow_dir: item?.actionflow_dir,
						name: item?.name
					},
					field_string
				})
			}

		} else {
			actionflow_objects.push({
				jscode: item?.text,
				actionflow_dir: item?.actionflow_dir,
				name: item?.name
			})
		}
	})

	if (actionflow_objects.length > 0) {
		batch_mutations.push({
			response_key: "insert_actionflow",
			operation: "insert_actionflow",
			objects: actionflow_objects,
			field_string
		})
	}
	if (batch_mutations <= 0) {
		throw new Error("远端暂无需要变更")
	}
	return await request.batch_mutation(batch_mutations);
}

// 将远程的代码同步到本地
async function downloadActionflow(name, actionflow_dir, isCover = false) {
	if (!actionflow_dir) {
		throw new Error("请指定要批量下载的文件夹路径actionflow_dir")
	}
	if (actionflow_dir.slice(0, 1) != "/" || actionflow_dir.slice(-1) != "/") {
		throw new Error(`actionflow_dir必须以【/】开头和结尾`);
	}

	// 查询出指定目录的代码
	let actionflow_lists = await request.query({
		model: "actionflow",
		field_string: `id name jscode actionflow_dir`,
		where: {
			...(name ? {
				name: {
					_eq: name
				}
			} : {}),
			...(actionflow_dir != "/" ? {
				actionflow_dir: {
					_like: `${actionflow_dir}%`
				}
			} : {})
		}
	})

	if (actionflow_lists.length <= 0) {
		throw new Error(`远端actionflow在该actionflow_dir下暂无对应内容`);
	}

	// 查询出本地列表
	let data = await request.getActionflowCode(name, actionflow_dir, "custom").catch(e => []);

	let actionflow_lists_save = [];
	actionflow_lists.forEach(item => {
		let findActionflow = data.find(item_a => item_a?.name == item?.name);
		if (findActionflow) {
			if (isCover) {
				actionflow_lists_save.push({
					actionflow_type: "custom",
					actionflow_dir: item?.actionflow_dir,
					actionflow_name: item?.name,
					jscode: item?.jscode
				})
			}

		} else {
			actionflow_lists_save.push({
				actionflow_type: "custom",
				actionflow_dir: item?.actionflow_dir,
				actionflow_name: item?.name,
				jscode: item?.jscode
			})
		}
	})
	if (actionflow_lists_save <= 0) {
		throw new Error("本地暂无需要变更")
	}
	return await request.setActionflowCode(actionflow_lists_save);
}


export default {
	updateActionflow,
	insertActionflow,
	// 获取本地所有自定义行为
	uploadActionflow,
	downloadActionflow

}