import unittest
import pandas as pd
from export_predictions import prepare_features


class FeatureContractTests(unittest.TestCase):
    def test_order_and_explicit_alias(self):
        x, valid = prepare_features(pd.DataFrame({'b': [2], 'a_clean': [1]}),
                                    ['a', 'b'], {'a': 'a_clean'}, [-9999])
        self.assertEqual(x.columns.tolist(), ['a', 'b'])
        self.assertEqual(x.iloc[0].tolist(), [1, 2])
        self.assertTrue(valid[0])

    def test_missing_values_are_not_filled(self):
        x, valid = prepare_features(pd.DataFrame({'a': [-9999, None, float('inf'), 0]}), ['a'], {}, [-9999])
        self.assertEqual(valid.tolist(), [False, False, False, True])
        self.assertTrue(x.a.isna().iloc[0])

    def test_missing_columns_fail(self):
        with self.assertRaises(ValueError):
            prepare_features(pd.DataFrame({'a': [1]}), ['b'], {}, [])

    def test_duplicate_features_fail(self):
        with self.assertRaises(ValueError):
            prepare_features(pd.DataFrame({'a': [1]}), ['a', 'a'], {}, [])


if __name__ == '__main__':
    unittest.main()
