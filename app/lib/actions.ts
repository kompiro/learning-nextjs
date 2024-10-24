'use server';

import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please seelect a customer',
    }),
    amount: z.coerce.number().gt(0, { message: 'Please enter an amount greather than $0.' }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select a status',
    }),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
    errors?: {
      customerId?: string[];
      amount?: string[];
      status?: string[];
    };
    message?: string | null;
  };

export async function createInvoice(prevSate: State, formData: FormData) {
    const validationFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validationFields.success) {
        return {
            errors: validationFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Faild to Create Invoice.'
        };
    }

    const { customerId, amount, status } = validationFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    try {

        await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        ;`;
    } catch (error) {
        return {
            message: `Database Error: Failed to create invoice.: ${error}`,
        }
    }
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
};

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(id: string, prevSate: State, formData: FormData) {
    const validationFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validationFields.success) {
        return {
            errors: validationFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Faild to Create Invoice.'
        };
    }
    
    const { customerId, amount, status } = validationFields.data;
    const amountInCents = amount * 100;

    try {
        await sql`
            UPDATE invoices
            SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
            WHERE id = ${id}
          `;
    } catch (error) {
        return {
            message: `Database Error: Failed to update invoice. ${error}`,
        }

    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
    } catch (error) {
        return {
            message: `Database Error: Failed to delete invoice. ${error}`,
        }
    }
    revalidatePath('/dashboard/invoices');
}

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
  ) {
    try {
      await signIn('credentials', formData);
    } catch (error) {
      if (error instanceof AuthError) {
        switch (error.type) {
          case 'CredentialsSignin':
            return 'Invalid credentials.';
          default:
            return 'Something went wrong.';
        }
      }
      throw error;
    }
  }
