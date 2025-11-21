module.exports = {
  apps: Array.from({ length: 98 }, (_, i) => {
    const num = i.toString().padStart(2, '0');
    return {
      name: `main-${num}`,
      script: 'node',  // 使用 node 作为脚本解释器
      args: `-r ts-node/register cmd/main${num}.ts`,  // 通过参数加载 ts-node
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'development',
        INSTANCE_ID: num,
        TS_NODE_PROJECT: 'tsconfig.json'
      },
      error_file: `./logs/main-${num}-error.log`,
      out_file: `./logs/main-${num}-out.log`,
      time: true
    };
  })
};