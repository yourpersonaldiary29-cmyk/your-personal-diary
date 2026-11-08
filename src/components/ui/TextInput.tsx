/**
 * Single-line text input styled with `.input`. Accepts every native input
 * attribute plus `ref` (React 19 passes it as a prop). Use inside <Field>.
 */
import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';

export interface TextInputProps extends ComponentPropsWithRef<'input'> {
  /** Narrow control (~8rem), e.g. for short codes. */
  short?: boolean;
}

export function TextInput({ className, type = 'text', short = false, ...rest }: TextInputProps) {
  return <input type={type} className={cx('input', short && 'input--short', className)} {...rest} />;
}
