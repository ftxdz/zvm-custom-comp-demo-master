import { useEffect, useRef } from "react";
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import "./App.css";
import * as echarts from "echarts";
import util from "./md_frame/util/index.js"

export function  EchartsTest() {
  // const [count, setCount] = useState(0)
  const chartRef: any = useRef(); //拿到DOM容器
  useEffect(() => {
    let xAxis:any = {
      data:[]
    }
    let data:any = []

    util.query({
      limit: 0,
      model: "order",
      field_string: `id goodsname count`,
    }).then((res:any)=>{
      console.log(res)
      res.map((item:any)=>{
        xAxis.data.push(item.goodsname)
        data.push(item.count)
      })

      const myChart = echarts.init(chartRef.current);
      myChart.setOption({
        title: {
          text: "Zion 自定义组件",
        },
        tooltip: {},
        xAxis,
        yAxis: {},
        series: [
          {
            name: "销量",
            type: "bar",
            data,
          },
        ],
      });
    })

  });

  return (
    <>
      {/* <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p> */}
      <div ref={chartRef} className="chart"></div>
    </>
  );
}
