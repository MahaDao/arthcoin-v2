import { ethers } from 'hardhat';
import { ParamType } from 'ethers/lib/utils';
import { Block, JsonRpcProvider, Provider } from '@ethersproject/providers';

export const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

export function encodeParameters(
  types: Array<string | ParamType>,
  values: Array<any>
) {
  const abi = new ethers.utils.AbiCoder();
  return abi.encode(types, values);
}

export async function wait(
  ethers: any,
  hash: string,
  desc?: string,
  confirmation: number = 1
): Promise<void> {
  if (desc) {
    console.log(`Waiting tx ${hash}. action = ${desc}\n`);
  } else {
    console.log(`Waiting tx ${hash}\n`);
  }
  await ethers.provider.waitForTransaction(hash, confirmation);
}

export async function latestBlocktime(provider: Provider): Promise<number> {
  const { timestamp } = await provider.getBlock('latest');
  return timestamp;
}

export async function advanceTime(
  provider: JsonRpcProvider,
  time: number
): Promise<void> {
  return provider.send('evm_increaseTime', [time]);
}

export async function advanceBlock(provider: JsonRpcProvider): Promise<Block> {
  await provider.send('evm_mine', []);
  return await provider.getBlock('latest');
}

export async function advanceTimeAndBlock(
  provider: JsonRpcProvider,
  time: number
): Promise<Block> {
  await advanceTime(provider, time);
  await advanceBlock(provider);
  return Promise.resolve(provider.getBlock('latest'));
}
