/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { forwardRef } from 'react';

/**
|--------------------------------------------------
| Button visual variants
|--------------------------------------------------
*/
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
|--------------------------------------------------
| Button props
|--------------------------------------------------
*/
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
}

/**
|--------------------------------------------------
| Variant class map
|--------------------------------------------------
*/
const VARIANTS: Record<Variant, string> = {
	ghost: 'bg-transparent text-fg hover:bg-bg-3',
	secondary: 'bg-bg-3 text-fg hover:brightness-110',
	primary: 'cx-primary bg-primary text-primary-fg hover:brightness-110',
	danger: 'bg-transparent text-error border border-error-bd hover:bg-error-bg',
};

/**
|--------------------------------------------------
| Themed button
|--------------------------------------------------
*/
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{ variant = 'secondary', className = '', ...props },
	ref,
) {
	/**
	|--------------------------------------------------
	| Render the styled button
	|--------------------------------------------------
	*/
	return (
		<button
			ref={ref}
			className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-[12.5px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
			{...props}
		/>
	);
});
