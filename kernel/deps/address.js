const BN = require('bn.js')
const U256 = require('./u256.js')

module.exports = class Address extends U256 {
  constructor (value) {
    super(value)
    if (this._value.byteLength() > 20) {
      throw new Error('Invalid address length: ' + this._value.byteLength() + ' for ' + value)
    }
  }

  // This assumes Uint8Array in LSB (WASM code)
  static fromMemory (value) {
    return new Address(new BN(value, 16, 'be'))
  }

  // This assumes Uint8Array in LSB (WASM code)
  toMemory () {
    return this._value.toBuffer('be', 20)
  }

  toBuffer () {
    return super.toBuffer(20)
  }

  toArray () {
    return [...this.toBuffer()]
  }

  // Needs to be displayed as a hex always
  toString () {
    return '0x' + this._value.toString('hex', 40)
  }

  static zero () {
    return new Address('0x0000000000000000000000000000000000000000')
  }

  isZero () {
    return this._value.isZero()
  }

  equals (address) {
    return this.toString() === address.toString()
  }
}
