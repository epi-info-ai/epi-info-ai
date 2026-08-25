#![cfg_attr(not(test), no_std)]

#[cfg(not(test))]
use core::panic::PanicInfo;

#[cfg(not(test))]
#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}

fn ratio(numerator: f64, denominator: f64) -> f64 {
    if denominator > 0.0 {
        numerator / denominator
    } else {
        f64::NAN
    }
}

#[unsafe(no_mangle)]
pub extern "C" fn risk_exposed(a: f64, b: f64) -> f64 {
    ratio(a, a + b)
}

#[unsafe(no_mangle)]
pub extern "C" fn risk_unexposed(c: f64, d: f64) -> f64 {
    ratio(c, c + d)
}

#[unsafe(no_mangle)]
pub extern "C" fn risk_ratio(a: f64, b: f64, c: f64, d: f64) -> f64 {
    ratio(risk_exposed(a, b), risk_unexposed(c, d))
}

#[unsafe(no_mangle)]
pub extern "C" fn odds_ratio(a: f64, b: f64, c: f64, d: f64) -> f64 {
    ratio(a * d, b * c)
}

#[unsafe(no_mangle)]
pub extern "C" fn risk_difference(a: f64, b: f64, c: f64, d: f64) -> f64 {
    let exposed = risk_exposed(a, b);
    let unexposed = risk_unexposed(c, d);
    if exposed.is_nan() || unexposed.is_nan() {
        f64::NAN
    } else {
        exposed - unexposed
    }
}

fn chi_square_denominator(a: f64, b: f64, c: f64, d: f64) -> f64 {
    (a + b) * (c + d) * (a + c) * (b + d)
}

#[unsafe(no_mangle)]
pub extern "C" fn pearson_chi_square(a: f64, b: f64, c: f64, d: f64) -> f64 {
    let total = a + b + c + d;
    let cross_product = a * d - b * c;
    ratio(total * cross_product * cross_product, chi_square_denominator(a, b, c, d))
}

#[unsafe(no_mangle)]
pub extern "C" fn mantel_haenszel_chi_square(a: f64, b: f64, c: f64, d: f64) -> f64 {
    let total = a + b + c + d;
    let cross_product = a * d - b * c;
    ratio((total - 1.0) * cross_product * cross_product, chi_square_denominator(a, b, c, d))
}

#[unsafe(no_mangle)]
pub extern "C" fn yates_chi_square(a: f64, b: f64, c: f64, d: f64) -> f64 {
    let total = a + b + c + d;
    let adjusted = ((a * d - b * c).abs() - total / 2.0).max(0.0);
    ratio(total * adjusted * adjusted, chi_square_denominator(a, b, c, d))
}

#[cfg(test)]
mod tests {
    use super::*;

    const TOLERANCE: f64 = 1.0e-12;

    fn assert_near(actual: f64, expected: f64) {
        assert!((actual - expected).abs() <= TOLERANCE, "expected {expected}, received {actual}");
    }

    #[test]
    fn outbreak_table_primitives_match_baseline() {
        let (a, b, c, d) = (40.0, 60.0, 10.0, 90.0);
        assert_near(risk_exposed(a, b), 0.4);
        assert_near(risk_unexposed(c, d), 0.1);
        assert_near(risk_ratio(a, b, c, d), 4.0);
        assert_near(odds_ratio(a, b, c, d), 6.0);
        assert_near(risk_difference(a, b, c, d), 0.3);
        assert_near(pearson_chi_square(a, b, c, d), 24.0);
        assert_near(mantel_haenszel_chi_square(a, b, c, d), 23.88);
        assert_near(yates_chi_square(a, b, c, d), 22.426_666_666_666_666);
    }

    #[test]
    fn undefined_denominators_return_nan() {
        assert!(risk_exposed(0.0, 0.0).is_nan());
        assert!(risk_ratio(1.0, 1.0, 0.0, 0.0).is_nan());
        assert!(odds_ratio(1.0, 0.0, 1.0, 0.0).is_nan());
    }
}
