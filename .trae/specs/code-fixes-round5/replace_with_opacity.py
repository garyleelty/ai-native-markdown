import os
import re

def replace_with_opacity_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    result = []
    i = 0
    changed = False
    
    while i < len(content):
        if content[i:i+13] == '.withOpacity(':
            result.append('.withValues(alpha: ')
            i += 13
            paren_count = 1
            while i < len(content) and paren_count > 0:
                if content[i] == '(':
                    paren_count += 1
                elif content[i] == ')':
                    paren_count -= 1
                result.append(content[i])
                i += 1
            changed = True
        else:
            result.append(content[i])
            i += 1
    
    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(''.join(result))
        print(f'Updated: {filepath}')
    return changed

def process_directory(directory):
    count = 0
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.dart'):
                filepath = os.path.join(root, file)
                if replace_with_opacity_in_file(filepath):
                    count += 1
    return count

if __name__ == '__main__':
    lib_dir = '/Users/tianyi/code/ai-native-markdown/lib'
    test_dir = '/Users/tianyi/code/ai-native-markdown/test'
    count = process_directory(lib_dir)
    count += process_directory(test_dir)
    print(f'Total files updated: {count}')
