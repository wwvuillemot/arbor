import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApiKeyInput } from '@/components/api-key-input';
import { NextIntlClientProvider } from 'next-intl';

const messages = {
  settings: {
    apiKeys: {
      openai: {
        label: 'OpenAI API Key',
        description: 'Your OpenAI API key for GPT models',
        placeholder: 'sk-...',
      },
      show: 'Show',
      hide: 'Hide',
      save: 'Save',
      saving: 'Saving...',
      saved: 'Saved',
    },
  },
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('ApiKeyInput', () => {
  it('should enable Save button when API key is entered', async () => {
    const onChange = vi.fn();
    const onSave = vi.fn();

    renderWithIntl(
      <ApiKeyInput
        label="OpenAI API Key"
        placeholder="sk-..."
        value=""
        onChange={onChange}
        onSave={onSave}
      />
    );

    const input = screen.getByPlaceholderText('sk-...');
    const saveButton = screen.getByRole('button', { name: /save/i });

    // Initially, Save button should be disabled (no changes)
    expect(saveButton).toBeDisabled();

    // Type a new API key
    fireEvent.change(input, { target: { value: 'sk-test-key-123' } });

    // Save button should now be enabled
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });

    expect(onChange).toHaveBeenCalledWith('sk-test-key-123');
  });

  it('should enable Save button when modifying existing API key', async () => {
    const onChange = vi.fn();
    const onSave = vi.fn();

    renderWithIntl(
      <ApiKeyInput
        label="OpenAI API Key"
        value="sk-existing-key"
        onChange={onChange}
        onSave={onSave}
      />
    );

    const input = screen.getByDisplayValue('sk-existing-key');
    const saveButton = screen.getByRole('button', { name: /save/i });

    // Initially, Save button should be disabled (no changes)
    expect(saveButton).toBeDisabled();

    // Modify the API key
    fireEvent.change(input, { target: { value: 'sk-new-key-456' } });

    // Save button should now be enabled
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });

    expect(onChange).toHaveBeenCalledWith('sk-new-key-456');
  });

  it('should disable Save button when value is reverted to original', async () => {
    const onChange = vi.fn();
    const onSave = vi.fn();

    renderWithIntl(
      <ApiKeyInput
        label="OpenAI API Key"
        value="sk-original"
        onChange={onChange}
        onSave={onSave}
      />
    );

    const input = screen.getByDisplayValue('sk-original');
    const saveButton = screen.getByRole('button', { name: /save/i });

    // Change the value
    fireEvent.change(input, { target: { value: 'sk-modified' } });
    await waitFor(() => expect(saveButton).not.toBeDisabled());

    // Revert to original
    fireEvent.change(input, { target: { value: 'sk-original' } });
    await waitFor(() => expect(saveButton).toBeDisabled());
  });

  it('should call onSave when Save button is clicked', async () => {
    const onChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);

    renderWithIntl(
      <ApiKeyInput
        label="OpenAI API Key"
        placeholder="sk-..."
        value=""
        onChange={onChange}
        onSave={onSave}
      />
    );

    const input = screen.getByPlaceholderText('sk-...');
    const saveButton = screen.getByRole('button', { name: /save/i });

    // Type a new API key
    fireEvent.change(input, { target: { value: 'sk-test-key' } });

    // Click Save
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
  });

  it('should toggle password visibility', () => {
    const onChange = vi.fn();
    const onSave = vi.fn();

    renderWithIntl(
      <ApiKeyInput
        label="OpenAI API Key"
        value="sk-secret-key"
        onChange={onChange}
        onSave={onSave}
      />
    );

    const input = screen.getByDisplayValue('sk-secret-key') as HTMLInputElement;
    const toggleButton = screen.getByRole('button', { name: /show/i });

    // Initially should be password type
    expect(input.type).toBe('password');

    // Click to show
    fireEvent.click(toggleButton);
    expect(input.type).toBe('text');

    // Click to hide
    const hideButton = screen.getByRole('button', { name: /hide/i });
    fireEvent.click(hideButton);
    expect(input.type).toBe('password');
  });

  it('should enable Save button when parent updates value prop via onChange', async () => {
    // This test simulates the actual bug scenario where the parent component
    // updates its state via onChange, which causes the value prop to change
    const onSave = vi.fn();

    function TestWrapper() {
      const [value, setValue] = React.useState('');

      return (
        <ApiKeyInput
          label="OpenAI API Key"
          placeholder="sk-..."
          value={value}
          onChange={setValue}
          onSave={onSave}
        />
      );
    }

    renderWithIntl(<TestWrapper />);

    const input = screen.getByPlaceholderText('sk-...');
    const saveButton = screen.getByRole('button', { name: /save/i });

    // Initially, Save button should be disabled
    expect(saveButton).toBeDisabled();

    // Type a new API key - this will call onChange which updates parent state
    fireEvent.change(input, { target: { value: 'sk-test-key-123' } });

    // Save button should be enabled even though value prop was updated
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });
  });

  it('should work correctly with empty initial value', async () => {
    const onChange = vi.fn();
    const onSave = vi.fn();

    renderWithIntl(
      <ApiKeyInput
        label="OpenAI API Key"
        placeholder="sk-..."
        value=""
        onChange={onChange}
        onSave={onSave}
      />
    );

    const input = screen.getByPlaceholderText('sk-...');
    const saveButton = screen.getByRole('button', { name: /save/i });

    // Initially, Save button should be disabled (no changes from empty)
    expect(saveButton).toBeDisabled();

    // Type a new API key
    fireEvent.change(input, { target: { value: 'sk-new-key' } });

    // Save button should be enabled
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled();
    });

    // Clear the input back to empty
    fireEvent.change(input, { target: { value: '' } });

    // Save button should be disabled again (back to initial value)
    await waitFor(() => {
      expect(saveButton).toBeDisabled();
    });
  });
});

