import ConnectButton from './connect'
import './App.css'
import injectedModule from '@web3-onboard/injected-wallets'
import init from '@web3-onboard/core'
import { Web3OnboardProvider } from '@web3-onboard/react'
const injected = injectedModule()
const chains = [
  {
    id: '0x4268',
    token: 'ETH',
    label: 'Holesky',
  },
]
const web3Onboard = init({
  wallets: [injected],
  chains,
})

function App() {
  return (
    <>
      Hello
      <Web3OnboardProvider web3Onboard={web3Onboard}>
          <ConnectButton />
      </Web3OnboardProvider>
    </>
  )
}

export default App
