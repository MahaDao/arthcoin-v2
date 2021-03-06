const chalk = require('chalk');
const BigNumber = require('bignumber.js');
const helpers = require('./helpers');
const SwapToPrice = artifacts.require("Uniswap/SwapToPrice");


module.exports = async function (deployer, network, accounts) {
  return
  const DEPLOYER_ADDRESS = accounts[0];

  const arth = await helpers.getARTH(network, deployer, artifacts);
  const arthx = await helpers.getARTHX(network, deployer, artifacts);
  const usdc = await helpers.getUSDC(network, deployer, artifacts);

  const maha = await helpers.getMahaToken(network, deployer, artifacts);
  const weth = await helpers.getWETH(network, deployer, artifacts);
  const uniswapRouter = await helpers.getUniswapRouter(network, deployer, artifacts);
  const uniswapFactory = await helpers.getUniswapFactory(network, deployer, artifacts);

  console.log(chalk.yellow('\nDeploying SwapToPrice'));
  await deployer.deploy(SwapToPrice, uniswapFactory.address, uniswapRouter.address);

  console.log(chalk.yellow('\nCreating ARTB uniswap pairs...'));
  await Promise.all([
    uniswapFactory.createPair(arth.address, arthx.address, { from: DEPLOYER_ADDRESS }),
    uniswapFactory.createPair(arth.address, maha.address, { from: DEPLOYER_ADDRESS }),
    uniswapFactory.createPair(arth.address, usdc.address, { from: DEPLOYER_ADDRESS }),
  ])
    .catch(e => console.log('error', e))
    .then(() => console.log(chalk.green('\nDone')))

  console.log(chalk.yellow('\nApproving uniswap pairs....'));
  await Promise.all([
    maha.approve(uniswapRouter.address, new BigNumber(2000000e18), { from: DEPLOYER_ADDRESS }),
    arth.approve(uniswapRouter.address, new BigNumber(2000000e18), { from: DEPLOYER_ADDRESS }),
    arthx.approve(uniswapRouter.address, new BigNumber(2000000e18), { from: DEPLOYER_ADDRESS }),
    usdc.approve(uniswapRouter.address, new BigNumber(2000000e18), { from: DEPLOYER_ADDRESS })
  ])
    .catch(e => console.log('error', e))
    .then(() => console.log(chalk.green('\nDone')))


  console.log(chalk.yellow('\nAdding liquidity to pairs...'));
  await Promise.all([
    // ARTHX / ARTH
    uniswapRouter.addLiquidity(
      arthx.address,
      arth.address,
      new BigNumber(100e18),
      new BigNumber(1e18),
      new BigNumber(100e18),
      new BigNumber(1e18),
      DEPLOYER_ADDRESS,
      new BigNumber(9999999999999),
      { from: DEPLOYER_ADDRESS }
    ),
    // ARTH / MAHA
    uniswapRouter.addLiquidity(
      arth.address,
      maha.address,
      new BigNumber(10e18),
      new BigNumber(1e18),
      new BigNumber(10e18),
      new BigNumber(1e18),
      DEPLOYER_ADDRESS,
      new BigNumber(9999999999999),
      { from: DEPLOYER_ADDRESS }
    ),
    uniswapRouter.addLiquidity(
      arth.address,
      usdc.address,
      new BigNumber(1e18),
      new BigNumber(2e6),
      new BigNumber(1e18),
      new BigNumber(2e6),
      DEPLOYER_ADDRESS,
      new BigNumber(9999999999999),
      { from: DEPLOYER_ADDRESS }
    )
  ]);

  /* For testnet's to deploy uniswap oracle */
  if (!helpers.isMainnet(network) && false) {
    const usdc = await helpers.getUSDC(network, deployer, artifacts);
    const usdt = await helpers.getUSDT(network, deployer, artifacts);
    const wbtc = await helpers.getWBTC(network, deployer, artifacts);
    const wmatic = await helpers.getWMATIC(network, deployer, artifacts);

    console.log(chalk.yellow('\nCreating USDC/USDT uniswap pairs....'));

    await Promise.all([
      uniswapFactory.createPair(usdc.address, weth.address, { from: DEPLOYER_ADDRESS }),
      uniswapFactory.createPair(usdt.address, weth.address, { from: DEPLOYER_ADDRESS }),
      uniswapFactory.createPair(wbtc.address, weth.address, { from: DEPLOYER_ADDRESS }),
      uniswapFactory.createPair(wmatic.address, weth.address, { from: DEPLOYER_ADDRESS }),
    ])
      .catch(e => console.log('error', e))
      .then(() => console.log(chalk.green('\nDone')))
    console.log(chalk.yellow('\nApproving USDC/USDT uniswap pairs....'));

    await Promise.all([
      weth.approve(uniswapRouter.address, new BigNumber(2000000e18), { from: DEPLOYER_ADDRESS }),
      usdc.approve(uniswapRouter.address, new BigNumber(2000000e18), { from: DEPLOYER_ADDRESS }),
      usdt.approve(uniswapRouter.address, new BigNumber(2000000e18), { from: DEPLOYER_ADDRESS }),
      wbtc.approve(uniswapRouter.address, new BigNumber(2000000e18), { from: DEPLOYER_ADDRESS }),
      wmatic.approve(uniswapRouter.address, new BigNumber(2000000e18), { from: DEPLOYER_ADDRESS }),
    ])
      .catch(e => console.log('error', e))
      .then(() => console.log(chalk.green('\nDone')))

    await Promise.all([
      // USDC/WETH
      uniswapRouter.addLiquidity(
        usdc.address,
        weth.address,
        new BigNumber(2200e4),
        new BigNumber(1e4),
        new BigNumber(2200e4),
        new BigNumber(1e4),
        DEPLOYER_ADDRESS,
        new BigNumber(9999999999999),
        { from: DEPLOYER_ADDRESS }
      ),
      // USDT/WETH
      uniswapRouter.addLiquidity(
        usdt.address,
        weth.address,
        new BigNumber(2200e4),
        new BigNumber(1e4),
        new BigNumber(2200e4),
        new BigNumber(1e4),
        DEPLOYER_ADDRESS,
        new BigNumber(9999999999999),
        { from: DEPLOYER_ADDRESS }
      ),
      uniswapRouter.addLiquidity(
        wbtc.address,
        weth.address,
        new BigNumber(2200e6),
        new BigNumber(1e16),
        new BigNumber(2200e6),
        new BigNumber(1e16),
        DEPLOYER_ADDRESS,
        new BigNumber(9999999999999),
        { from: DEPLOYER_ADDRESS }
      ),
      uniswapRouter.addLiquidity(
        wmatic.address,
        weth.address,
        new BigNumber(2200e16),
        new BigNumber(1e16),
        new BigNumber(2200e16),
        new BigNumber(1e16),
        DEPLOYER_ADDRESS,
        new BigNumber(9999999999999),
        { from: DEPLOYER_ADDRESS }
      ),
    ]);
  }
};
