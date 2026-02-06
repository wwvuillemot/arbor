import { describe, it, expect, beforeEach } from 'vitest';
import { commandRegistry } from '../../src/lib/command-registry';

describe('CommandRegistry', () => {
  // Use the singleton instance but clear it before each test
  const registry = commandRegistry;

  beforeEach(() => {
    // Clear the registry before each test
    registry.clear();
  });

  describe('register', () => {
    it('should register a command', () => {
      const command = {
        id: 'test-command',
        label: 'Test Command',
        action: () => { },
      };

      registry.register(command);
      const commands = registry.getCommands();

      expect(commands).toHaveLength(1);
      expect(commands[0]).toEqual(command);
    });

    it('should return an unregister function', () => {
      const command = {
        id: 'test-command',
        label: 'Test Command',
        action: () => { },
      };

      const unregister = registry.register(command);
      expect(registry.getCommands()).toHaveLength(1);

      unregister();
      expect(registry.getCommands()).toHaveLength(0);
    });

    it('should replace existing command with same id', () => {
      const command1 = {
        id: 'test-command',
        label: 'First Command',
        action: () => { },
      };

      const command2 = {
        id: 'test-command',
        label: 'Second Command',
        action: () => { },
      };

      registry.register(command1);
      registry.register(command2);

      const commands = registry.getCommands();
      expect(commands).toHaveLength(1);
      expect(commands[0].label).toBe('Second Command');
    });
  });

  describe('registerMany', () => {
    it('should register multiple commands', () => {
      const commands = [
        { id: 'cmd1', label: 'Command 1', action: () => { } },
        { id: 'cmd2', label: 'Command 2', action: () => { } },
        { id: 'cmd3', label: 'Command 3', action: () => { } },
      ];

      registry.registerMany(commands);
      expect(registry.getCommands()).toHaveLength(3);
    });

    it('should return an unregister function that removes all commands', () => {
      const commands = [
        { id: 'cmd1', label: 'Command 1', action: () => { } },
        { id: 'cmd2', label: 'Command 2', action: () => { } },
      ];

      const unregister = registry.registerMany(commands);
      expect(registry.getCommands()).toHaveLength(2);

      unregister();
      expect(registry.getCommands()).toHaveLength(0);
    });
  });

  describe('registerGroup', () => {
    it('should register a command group', () => {
      const group = { id: 'test-group', label: 'Test Group', priority: 100 };

      registry.registerGroup(group);
      const groups = registry.getGroups();

      expect(groups).toHaveLength(1);
      expect(groups[0]).toEqual(group);
    });
  });

  describe('getCommandsByGroup', () => {
    it('should return commands filtered by group', () => {
      registry.register({ id: 'cmd1', label: 'Command 1', group: 'group1', action: () => { } });
      registry.register({ id: 'cmd2', label: 'Command 2', group: 'group2', action: () => { } });
      registry.register({ id: 'cmd3', label: 'Command 3', group: 'group1', action: () => { } });

      const group1Commands = registry.getCommandsByGroup('group1');
      expect(group1Commands).toHaveLength(2);
      expect(group1Commands.map(c => c.id)).toEqual(['cmd1', 'cmd3']);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      registry.register({
        id: 'cmd1',
        label: 'Create New Project',
        description: 'Start a new writing project',
        keywords: ['new', 'project', 'create'],
        action: () => { },
      });

      registry.register({
        id: 'cmd2',
        label: 'Open Settings',
        description: 'Configure application settings',
        keywords: ['settings', 'preferences', 'config'],
        action: () => { },
      });

      registry.register({
        id: 'cmd3',
        label: 'Save Document',
        description: 'Save the current document',
        keywords: ['save', 'write'],
        action: () => { },
      });
    });

    it('should search by label', () => {
      const results = registry.search('settings');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('cmd2');
    });

    it('should search by description', () => {
      const results = registry.search('writing');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('cmd1');
    });

    it('should search by keywords', () => {
      const results = registry.search('config');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('cmd2');
    });

    it('should be case-insensitive', () => {
      const results = registry.search('SETTINGS');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('cmd2');
    });

    it('should return empty array for no matches', () => {
      const results = registry.search('nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('subscribe', () => {
    it('should notify listeners when commands are registered', () => {
      let notified = false;
      const unsubscribe = registry.subscribe(() => {
        notified = true;
      });

      registry.register({ id: 'cmd1', label: 'Command 1', action: () => { } });
      expect(notified).toBe(true);

      unsubscribe();
    });

    it('should notify listeners when commands are unregistered', () => {
      let notifyCount = 0;
      registry.subscribe(() => {
        notifyCount++;
      });

      const unregister = registry.register({ id: 'cmd1', label: 'Command 1', action: () => { } });
      expect(notifyCount).toBe(1);

      unregister();
      expect(notifyCount).toBe(2);
    });

    it('should return an unsubscribe function', () => {
      let notifyCount = 0;
      const unsubscribe = registry.subscribe(() => {
        notifyCount++;
      });

      registry.register({ id: 'cmd1', label: 'Command 1', action: () => { } });
      expect(notifyCount).toBe(1);

      unsubscribe();

      registry.register({ id: 'cmd2', label: 'Command 2', action: () => { } });
      expect(notifyCount).toBe(1); // Should not increment after unsubscribe
    });
  });

  describe('clear', () => {
    it('should remove all commands and groups', () => {
      registry.register({ id: 'cmd1', label: 'Command 1', action: () => { } });
      registry.register({ id: 'cmd2', label: 'Command 2', action: () => { } });
      registry.registerGroup({ id: 'group1', label: 'Group 1' });

      expect(registry.getCommands()).toHaveLength(2);
      expect(registry.getGroups()).toHaveLength(1);

      registry.clear();

      expect(registry.getCommands()).toHaveLength(0);
      expect(registry.getGroups()).toHaveLength(0);
    });

    it('should notify listeners when cleared', () => {
      let notified = false;
      registry.subscribe(() => {
        notified = true;
      });

      registry.clear();
      expect(notified).toBe(true);
    });
  });
});


