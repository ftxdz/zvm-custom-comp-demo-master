import fs from "fs"
import path from "path"

// 读取指定目录或者指定文件的js内容
function getJSFiles(directoryPath, name = "", fileList = []) {
	if (name) {
		const filePath = directoryPath + name + ".js";
		if (fs.existsSync(filePath)) {
			// 读取并返回文件内容
			const text = fs.readFileSync(filePath, 'utf8');
			fileList.push({
				dir: directoryPath,
				name,
				text
			})

		} else {
			throw new Error(`${filePath}文件不存在`)
		}

	} else {
		const files = fs.readdirSync(directoryPath);
		files.forEach((fileName) => {
			const filePath = directoryPath + fileName + "/";

			if (fs.statSync(filePath).isDirectory()) {
				// 递归读取子目录下的文件
				getJSFiles(filePath, undefined, fileList);
			} else if (path.extname(fileName) === '.js') {
				const text = fs.readFileSync(filePath, 'utf8');
				fileList.push({
					dir: directoryPath,
					name: fileName.slice(0, -3),
					text
				});
			}
		});
	}
	return fileList;
}

// 写入js文件到指定目录
function writeJSFiles(directoryPath, name = "", jscode = "") {
	const filePath = directoryPath + name + ".js";;
	const dirname = path.dirname(filePath);
	// 确保文件夹存在
	if (!fs.existsSync(dirname)) {
		fs.mkdirSync(dirname, {
			recursive: true
		});
	}
	// 写入文件 
	fs.writeFileSync(filePath, jscode);

	return {
		dir: directoryPath,
		name,
		text: jscode
	};
}

// 读文件入口
async function readfile(req) {
	let {
		actionflow_name,
		actionflow_type = "custom",
		actionflow_dir = "/"
	} = req?.body;
	actionflow_dir = (actionflow_dir || "/");
	if (actionflow_dir.slice(0, 1) != "/" || actionflow_dir.slice(-1) != "/") {
		throw new Error(`actionflow_dir必须以【/】开头和结尾`);
	}
	if (!(actionflow_type == "custom" || actionflow_type == "native" || actionflow_type == "frame")) {
		throw new Error(`actionflow_type只能选择为：1.custom 2.native 3.frame`);
	}
	const basePath = `./${actionflow_type=="frame"?"":"actionflow_"}${actionflow_type}`;
	const directoryPath = `${basePath}${actionflow_dir}`;
	let jsFiles = getJSFiles(directoryPath, actionflow_name);
	jsFiles.forEach(jsFile => {
		jsFile.actionflow_dir = jsFile.dir.slice(basePath.length);
	})
	return jsFiles;
}

// 写文件入口
async function writefile(req) {
	let {
		list = []
	} = req?.body;
	if (!Array.isArray(list) || list.length <= 0) {
		throw new Error('list格式不正确或传入为空数组')
	}

	let jsFiles = [];
	// 第一遍先进行数组数据验证
	list.forEach((item, index) => {
		let {
			actionflow_name,
			actionflow_type = "custom",
			actionflow_dir = "/",
			jscode = ""
		} = item;
		actionflow_dir = (actionflow_dir || "/");
		if (actionflow_dir.slice(0, 1) != "/" || actionflow_dir.slice(-1) != "/") {
			throw new Error(`index:${index}验证不通过，actionflow_dir必须以【/】开头和结尾`);
		}
		if (!(actionflow_type == "custom" || actionflow_type == "native")) {
			throw new Error(
				`index:${index}验证不通过，actionflow_type只能选择为：1.custom 2.native，当前值：${actionflow_type}`);
		}
		if (!actionflow_name) {
			throw new Error(`index:${index}验证不通过，actionflow_name必须传入`)
		}
	})
	// 第二遍进行实际写入
	list.forEach((item, index) => {
		let {
			actionflow_name,
			actionflow_type = "custom",
			actionflow_dir = "/",
			jscode = ""
		} = item;
		// 写入文件到目录
		const basePath = `./actionflow_${actionflow_type}`;
		const directoryPath = `${basePath}${actionflow_dir}`;
		let jsFile = writeJSFiles(directoryPath, actionflow_name, jscode);
		jsFile.actionflow_dir = jsFile.dir.slice(basePath.length);
		jsFiles.push(jsFile);
	})
	return jsFiles;
}

// 获取文件信息
export default {
	readfile,
	writefile
}