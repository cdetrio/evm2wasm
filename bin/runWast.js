#!/usr/bin/env node
const ethUtil = require('ethereumjs-util')
const cp = require('child_process')
const fs = require('fs')
const path = require('path')

const Kernel = require('../kernel')

const Vertex = require('merkle-trie')
const transcompiler = require('../index.js')
const Interface = require('../kernel/EVMimports')
const DebugInterface = require('../kernel/debugInterface')
const Environment = require('../kernel/environment.js')


main().then(function() {
  console.log('success')
}).catch(function(err) {
  console.log('error:', err)
})

async function main() {
  //const code = Buffer.from(process.argv[2], 'hex')
  const evmBytecode = fs.readFileSync(process.argv[2], 'utf8')
  const code = Buffer.from(evmBytecode, 'hex')

  console.log('evmBytecode:', code.toString('hex'))
  const wasmCode = await transcompiler.evm2wasm(code, {
                      stackTrace: false,
                      inlineOps: true,
                      pprint: false,
                      wabt: true
                    })

  console.log('wasmCode:', wasmCode)
  runWasmCode(wasmCode)

}


async function runWasmCode(wasmCode) {
  const rootVertex = new Vertex()
  const environment = setupEnviroment(rootVertex)

  try {
    const kernel = new Kernel({
      code: wasmCode,
      interfaces: [Interface, DebugInterface]
    })
    console.log('calling kernel.run..')
    const instance = await kernel.run(environment)
    console.log('kernel.run returned.')
  } catch (e) {
    console.log('VM test runner caught exception: ' + e)
  }

  return

  /*
  const mod = WebAssembly.Module(wasmCode)
  let wasmVm = createVM()
  let wasmImports = wasmImportThingie(wasmVm)
  //const instance = WebAssembly.Instance(mod, {}) //  TypeError: WebAssembly Instantiation: Import #0 module="ethereum" error: module is not an object or function
  //const instance = WebAssembly.Instance(mod, wasmImports)
  //const instance = WebAssembly.Instance(mod, wasmImports)
  console.log('running wasm..')
  wasmVm.run(mod, wasmImports)
  */

  //wasmVm.wasmInstance = instance
  /*
  console.time('wasm-benchmark')
  instance.exports.main()
  console.timeEnd('wasm-benchmark')
  */
}



function createVM() {
  class VM {
    constructor() {
      //this._environment = new Environment({state: this})
      this._environment = new Environment()
    }
    
    set wasmInstance (inst) {
      this._instance = inst
    }

    get environment () {
      console.log('VM environment..')
      return this._environment
    }

    get memory () {
      //console.log('wasmImportThingie get memory()')
      return this._instance.exports.memory.buffer
    }
    
    run (codeModule, wasmImports) {
      // TODO, delete the instance once done.

      const instance = WebAssembly.Instance(codeModule, wasmImports)
      this._instance = instance
      if (instance.exports.main) {
        console.time('wasm-benchmark')
        instance.exports.main()
        console.timeEnd('wasm-benchmark')
      }
      //console.log('calling return this.onDone()..')
      //return this.onDone()
    }

    /**
     * addes an aync operation to the operations queue
     */
    pushOpsQueue (promise, callbackIndex, interfaceCallback) {
      console.log('pushOpsQueue callbackIndex:', callbackIndex)
      this._opsQueue = Promise.all([this._opsQueue, promise]).then(values => {
        //console.log('values:', values)
        console.log('calling interfaceCallback')
        const result = interfaceCallback(values.pop())
        //console.log('this._instance.exports:', this._instance.exports)
        console.log('calling callback..')
        this._instance.exports[callbackIndex.toString()](result)
      }).catch(err => {
        console.log('pushOps caught error:', err)
      })
    }
    
    async onDone () {
      console.log('onDone.')
      let prevOps
      while (prevOps !== this._opsQueue) {
        prevOps = this._opsQueue
        console.log('awaiting this._opsQueue...')
        await this._opsQueue
      }
      console.log('while loop done.')
      /*
      pushOps caught error: TypeError: path.shift is not a function
      at Store._get (/Users/macbook/dev_wasm/evm2wasm/node_modules/merkle-trie/store.js:55:44)
      at Promise (/Users/macbook/dev_wasm/evm2wasm/node_modules/merkle-trie/store.js:42:12)
      at Promise (<anonymous>)
      at Store.get (/Users/macbook/dev_wasm/evm2wasm/node_modules/merkle-trie/store.js:41:12)
      at Promise (/Users/macbook/dev_wasm/evm2wasm/node_modules/merkle-trie/index.js:116:21)
      at Promise (<anonymous>)
      at Vertex.get (/Users/macbook/dev_wasm/evm2wasm/node_modules/merkle-trie/index.js:111:12)
      at Interface.codeCopy (/Users/macbook/dev_wasm/evm2wasm/kernel/EVMimports.js:254:10)
      at <WASM UNNAMED> (<WASM>[22]+128)
      at <WASM UNNAMED> (<WASM>[40]+83789)
      */
    }

  }

  const wasmVm = new VM();
  return wasmVm
}


function wasmImportThingie(wasmVm) {

  const interfaces = [Interface, DebugInterface]

  console.log('building wasm imports..')
  //const wasmImports = buildImports(this._vm, opts.interfaces)
  const wasmImports = buildImports(wasmVm, interfaces)

  function buildImports (api, imports = [Imports]) {
    return imports.reduce((obj, InterfaceConstuctor) => {
      obj[InterfaceConstuctor.name] = new InterfaceConstuctor(api).exports
      return obj
    }, {})
  }
  
  return wasmImports
}



function setupEnviroment (rootVertex) {
  const env = new Environment()

  /*
  env.gasLeft = parseInt(testData.exec.gas.slice(2), 16)
  env.callData = new Uint8Array(Buffer.from(testData.exec.data.slice(2), 'hex'))
  env.gasPrice = ethUtil.bufferToInt(Buffer.from(testData.exec.gasPrice.slice(2), 'hex'))

  env.address = new Address(testData.exec.address)
  env.caller = new Address(testData.exec.caller)
  env.origin = new Address(testData.exec.origin)
  env.value = new U256(testData.exec.value)

  env.callValue = new U256(testData.exec.value)
  env.code = new Uint8Array(new Buffer(testData.exec.code.slice(2), 'hex'))

  // setup block
  env.block.header.number = testData.env.currentNumber
  env.block.header.coinbase = new Buffer(testData.env.currentCoinbase.slice(2), 'hex')
  env.block.header.difficulty = testData.env.currentDifficulty
  env.block.header.gasLimit = new Buffer(testData.env.currentGasLimit.slice(2), 'hex')
  env.block.header.number = new Buffer(testData.env.currentNumber.slice(2), 'hex')
  env.block.header.timestamp = new Buffer(testData.env.currentTimestamp.slice(2), 'hex')

  for (let address in testData.pre) {
    const account = testData.pre[address]
    const accountVertex = new Vertex()

    accountVertex.set('code', new Vertex({
      value: new Buffer(account.code.slice(2), 'hex')
    }))

    accountVertex.set('balance', new Vertex({
      value: new Buffer(account.balance.slice(2), 'hex')
    }))

    for (let key in account.storage) {
      accountVertex.set(['storage', ...new Buffer(key.slice(2), 'hex')], new Vertex({
        value: new Buffer(account.storage[key].slice(2), 'hex')
      }))
    }

    const path = [...new Buffer(address.slice(2), 'hex')]
    rootVertex.set(path, accountVertex)
    env.state = accountVertex
  }
  */

  return env
}


