import express from "express";
import config from "../config.js"
import request from "./request.js"
const app = express();

let {
	server_port = 3000,
} = config;
// 转换body参数
app.use(express.json());
// 处理跨域
app.all('*', function(req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	res.header('Access-Control-Allow-Methods', '*');
	res.header('Content-Type', 'application/json;charset=utf-8');
	next();
});
// 读文件
app.all("/readfile", async (req, res) => {
	try {
		let response = await request.readfile(req)
		res.send({
			data: response,
			status: "成功",
			msg: "ok"
		})
	} catch (e) {
		res.send({
			status: "失败",
			msg: e?.message || e || "系统内部错误"
		})
	}
})

// 写文件
app.all("/writefile", async (req, res) => {
	try {
		let response = await request.writefile(req)
		res.send({
			data: response,
			status: "成功",
			msg: "ok"
		})
	} catch (e) {
		res.send({
			status: "失败",
			msg: e?.message || e || "系统内部错误"
		})
	}
})

// 放在最后拦截无效路由
app.use("/", async (req, res) => {
	res.send({
		status: "失败",
		msg: "不存在的路由"
	})
})
app.listen(server_port, () => {
	console.log(`🚀  Server ready at http://localhost:${server_port}`)
})