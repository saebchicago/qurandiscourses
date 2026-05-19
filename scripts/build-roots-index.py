#!/usr/bin/env python3
"""Build enhanced roots index with first/last occurrences and all derived forms."""

import json
import os
from collections import defaultdict

def main():
    # Load existing roots summary
    with open('data/roots-summary.json', 'r', encoding='utf-8') as f:
        roots_summary = json.load(f)

    # Build enhanced index
    roots_index = {}
    root_occurrences = defaultdict(list)  # Track all occurrences per root
    lemma_occurrences = defaultdict(list)  # Track occurrences per lemma

    # Process all morphology files
    for surah in range(1, 115):
        morph_file = f'data/morphology/{surah}.json'
        if not os.path.exists(morph_file):
            continue

        with open(morph_file, 'r', encoding='utf-8') as f:
            surah_data = json.load(f)

        for verse_num, words in surah_data.items():
            for word in words:
                root = word.get('root')
                lemma = word.get('lemma')
                if root and root in roots_summary:
                    ref = f"{surah}:{verse_num}"
                    root_occurrences[root].append(ref)
                    if lemma:
                        lemma_key = f"{root}:{lemma}"
                        lemma_occurrences[lemma_key].append(ref)

    # Build final index
    for root_buck, root_info in roots_summary.items():
        occurrences = root_occurrences.get(root_buck, [])
        if not occurrences:
            continue

        # Build derived forms
        derived_forms = []
        for lemma_info in root_info.get('topLemmas', []):
            lemma = lemma_info['lemma']
            lemma_key = f"{root_buck}:{lemma}"
            lemma_refs = lemma_occurrences.get(lemma_key, [])

            derived_forms.append({
                'form': lemma_info['lemmaArabic'],
                'formLatin': lemma,
                'count': lemma_info['count'],
                'occurrences': lemma_refs[:10]  # Limit to first 10 for performance
            })

        roots_index[root_info['rootLatin']] = {
            'arabic': root_info['rootArabic'],
            'frequency': root_info['totalCount'],
            'first_occurrence': occurrences[0] if occurrences else None,
            'last_occurrence': occurrences[-1] if occurrences else None,
            'derived_forms': derived_forms
        }

    # Write output
    with open('data/roots-index.json', 'w', encoding='utf-8') as f:
        json.dump(roots_index, f, ensure_ascii=False, indent=2)

    print(f"Built roots index with {len(roots_index)} roots")

    # Spot-check known roots
    test_roots = [
        ('r-h-m', 'r-ḥ-m', 339),  # mercy (approximate transliteration)
        ('k-t-b', 'k-t-b', 319),  # write
        ('q-r-A', 'q-r-ʾ', 88)    # read (approximate)
    ]

    for root_search, root_display, expected_freq in test_roots:
        # Find root by checking if it's close
        found = False
        for root_key, root_data in roots_index.items():
            if root_search.replace('-', '') in root_key.replace('-', '').lower():
                freq = root_data['frequency']
                print(f"  {root_display}: {freq} (expected ~{expected_freq}) - {'✓' if abs(freq - expected_freq) < 50 else 'Nuanced'}")
                found = True
                break
        if not found:
            print(f"  {root_display}: NOT FOUND")

if __name__ == '__main__':
    main()
